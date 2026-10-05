import {
     ChannelType,
     ActionRowBuilder,
     StringSelectMenuBuilder, 
     StringSelectMenuOptionBuilder,  
    } from "discord.js";
import type { CaseParticipant, CourtCaseRoles } from '../interfaces/ICourtCase.ts';
export async function createDiscordChannel(interaction: any) {
    try {
        return await interaction.guild.channels.create({
            name: `court-case-${interaction.user.id}`,
            type: ChannelType.GuildText
        });
    } 
    catch(error) {
        console.error("there was an error" + error);
        return null;
    }
}

function participantFor(value: string, members: any[]): CaseParticipant {
    if (value === 'AI') return { kind: 'ai', name: null };

    const member = members.find((candidate) => candidate.id === value);
    return {
        kind: 'human',
        userId: value,
        name: member?.displayName ?? null,
    };
}

// Ask the case owner who will fill each role and return the selections.
export async function getRolesInfo(channel: any, interaction: any, users: string[]): Promise<CourtCaseRoles | null> {

    const memberPromises = users.map(id => interaction.guild.members.fetch(id).catch(() => null));
    const members = (await Promise.all(memberPromises)).filter(m => m !== null);

    const menuOptions = members.map(member => 
        new StringSelectMenuOptionBuilder()
            .setLabel(member.displayName)
            .setValue(member.id)
    );


    const AIoption = new StringSelectMenuOptionBuilder()
        .setLabel("AI")
        .setDescription("if no user available")
        .setValue("AI")

    menuOptions.push(AIoption);

    const createMenu = (customId: string, placeholder: string, multiple: boolean) => {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .setMinValues(1)
            .setMaxValues(multiple ? menuOptions.length : 1)
            .addOptions(menuOptions);

        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    };

    await channel.send({
        content: 'Assign the court roles. Select one person for plaintiff and defendant; attorneys, witnesses, and jury may have multiple members.',
        components: [
            createMenu('custom_Plaintiff_select', 'Choose a Plaintiff...', false),
            createMenu('custom_Defendant_select', 'Choose a Defendant...', false),
            createMenu('custom_Attorneys_select', 'Choose Attorney(s)...', true),
            createMenu('custom_witness_select', 'Choose Witness(es)...', true),
            createMenu('custom_Jury_select', 'Choose Juror(s)...', true),
        ],
    });

    return new Promise((resolve) => {
        const selections = new Map<string, string[]>();
        const requiredRoles = [
            'custom_Plaintiff_select',
            'custom_Defendant_select',
            'custom_Attorneys_select',
            'custom_witness_select',
            'custom_Jury_select',
        ];
        const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
        }, 120000);

        const onInteraction = async (component: any) => {
            if (!component.isStringSelectMenu()
                || component.user.id !== interaction.user.id
                || component.channelId !== channel.id
                || !requiredRoles.includes(component.customId)) return;

            selections.set(component.customId, component.values);
            await component.deferUpdate();

            if (requiredRoles.every((role) => selections.has(role))) {
                cleanup();
                const roleParticipants = (role: string): CaseParticipant[] =>
                    (selections.get(role) ?? []).map((value) => participantFor(value, members));
                const singleParticipant = (role: string): CaseParticipant | null =>
                    roleParticipants(role)[0] ?? null;

                resolve({
                    judge: { kind: 'ai', name: null },
                    plaintiff: singleParticipant('custom_Plaintiff_select'),
                    defendant: singleParticipant('custom_Defendant_select'),
                    attorneys: roleParticipants('custom_Attorneys_select'),
                    witnesses: roleParticipants('custom_witness_select'),
                    jury: roleParticipants('custom_Jury_select'),
                });
            }
        };

        function cleanup() {
            clearTimeout(timeout);
            interaction.client.off('interactionCreate', onInteraction);
        }

        interaction.client.on('interactionCreate', onInteraction);
    });
}