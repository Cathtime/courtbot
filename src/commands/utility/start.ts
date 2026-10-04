import { Message, SlashCommandBuilder } from 'discord.js';
import { isMemberInServer } from '../../misc/verifyUserId.ts';
import 'dotenv/config';

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
    }
}
