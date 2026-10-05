import {SlashCommandBuilder } from 'discord.js';
import { isMemberInServer } from '../../misc/verifyUserId.ts';
import 'dotenv/config';
import { createDiscordChannel, getRolesInfo } from '../../misc/courtLoop.ts';
import { appendTranscriptEntry, saveCourtCase } from '../../misc/caseStore.ts';
import type { CaseParticipant, CourtCase } from '../../interfaces/ICourtCase.ts';

const Stage = {
    Pinging: 0,
    Confirming: 1
} as const;

type Stage = typeof Stage[keyof typeof Stage];

export default {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Starts a court round')
        .addStringOption(option =>
            option.setName('playercount')
                .setDescription('How many players will be in the round?')
                .setRequired(false)
        ),
    async execute(interaction: any) {
        await interaction.reply(`Please ping everyone that will be included!`);

        let allExtractedIds: string[] = [];

        const userResponse = await new Promise<string | null>((resolve) => {
            let currentStage: Stage = Stage.Pinging;

            const safetyTimer = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 60000); 

            async function messageListener(message: any) {
                if (message.author.bot || message.author.id !== interaction.user.id || message.channel.id !== interaction.channelId) return;

                const contentLower = message.content.toLowerCase().trim();

                if (currentStage === Stage.Pinging) {
                    const matches = [...message.content.matchAll(/<@!?(\d+)>/g)];
                    
                    if (matches.length === 0) {
                        await interaction.followUp("That's not a ping. Please ping everyone that will be included!");
                        return;
                    }

                    const ids = matches.map(match => match[1]);
                    let turnIds: string[] = [];

                    for (const id of ids) {
                        if (await isMemberInServer(interaction.guild, id)) {
                            turnIds.push(id);
                        }
                    }

                    if (turnIds.length > 0) {
                        allExtractedIds.push(...turnIds);
                        currentStage = Stage.Confirming; 
                        await interaction.followUp("Is that everyone entering? {yes/no}");
                    } else {
                        await interaction.followUp("None of those pings were valid server members. Please try again!");
                    }
                    return;
                }

                if (currentStage === Stage.Confirming) {
                    if (contentLower === 'yes') {
                        cleanup();
                        resolve("yes");
                        return;
                    } 
                    
                    if (contentLower === 'no') {
                        currentStage = Stage.Pinging; 
                        await interaction.followUp("Please ping everyone that will be included!");
                        return;
                    }

                    await interaction.followUp("Is that everyone entering? {yes/no}");
                    return;
                }
            }

            function cleanup() {
                clearTimeout(safetyTimer); 
                interaction.client.off('messageCreate', messageListener);
            }

            interaction.client.on('messageCreate', messageListener);
        });

        if (userResponse === null) {
            await interaction.followUp("User took too long to reply.");
            return;
        }

        console.log(`Continuing execution. Total IDs found:`, allExtractedIds);

        const channel = await createDiscordChannel(interaction);
        if (channel === null) {
            await interaction.followUp("channel creation failed");
            return;
        }

        const now = new Date().toISOString();
        const participantFor = (userId: string): CaseParticipant => ({
            kind: 'human',
            userId,
            name: null,
        });
        const courtCase: CourtCase = {
            caseId: channel.id,
            title: `Court case ${channel.id}`,
            description: '',
            status: 'setup',
            createdAt: now,
            updatedAt: now,
            participants: allExtractedIds.map(participantFor),
            roles: {
                judge: { kind: 'ai', name: null },
                plaintiff: allExtractedIds[0] ? participantFor(allExtractedIds[0]) : null,
                defendant: allExtractedIds[1] ? participantFor(allExtractedIds[1]) : null,
                attorneys: [],
                witnesses: [],
                jury: [],
            },
            transcriptFile: 'transcript.jsonl',
        };

        await saveCourtCase(courtCase);
        await appendTranscriptEntry(courtCase.caseId, {
            timestamp: now,
            speaker: 'system',
            name: 'Court',
            role: 'system',
            content: 'Case opened. The case JSON is the editable source of truth for roles and names.',
        });
        await interaction.followUp(`Case saved to data/cases/${courtCase.caseId}/case.json. Edit that file to set the title, roles, or AI names.`);

        const selectedRoles = await getRolesInfo(channel, interaction, allExtractedIds);
        if (selectedRoles === null) {
            await interaction.followUp('Role selection timed out. The case JSON was created, but its roles are still editable.');
            return;
        }

        courtCase.roles = selectedRoles;
        await saveCourtCase(courtCase);
        await appendTranscriptEntry(courtCase.caseId, {
            timestamp: new Date().toISOString(),
            speaker: 'system',
            name: 'Court',
            role: 'system',
            content: `Roles assigned: ${JSON.stringify(selectedRoles)}`,
        });
        await interaction.followUp(`Roles saved to data/cases/${courtCase.caseId}/case.json.`);
        
    }
}
