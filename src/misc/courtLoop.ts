import {
    ActionRowBuilder,
    ChannelType,
    ComponentType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import { assignRoleToCase, createCourtCase, type CourtRole } from './courtState.ts';

const COURT_ROLES: CourtRole[] = ['witness', 'defendant', 'jury', 'attorney', 'plaintiff', 'judge'];

export async function createDiscordChannel(interaction: any) {
    try {
        return await interaction.guild.channels.create({
            name: `court-case-${interaction.user.id}`,
            type: ChannelType.GuildText,
        });
    } catch (error) {
        console.error('there was an error' + error);
        return null;
    }
}

// ask the owner of the match who will be what based on the available players.
export async function getRolesInfo(interaction: any, users: string[], channelId: string) {
    const memberPromises = users.map((id) => interaction.guild.members.fetch(id).catch(() => null));
    const members = (await Promise.all(memberPromises)).filter((member) => member !== null);

    const menuOptions = members.map((member) =>
        new StringSelectMenuOptionBuilder().setLabel(member.displayName).setValue(member.id),
    );

    const AIoption = new StringSelectMenuOptionBuilder()
        .setLabel('AI')
        .setDescription('if no user available')
        .setValue('AI');

    menuOptions.push(AIoption);

    const caseId = await createCourtCase({
        guildId: interaction.guild.id,
        channelId,
        createdBy: interaction.user.id,
        participants: members.map((member) => ({
            id: member.id,
            name: member.displayName,
        })),
    });

    for (const role of COURT_ROLES) {
        const customId = `court_role_${role}_${Date.now()}`;

        const roleSelect = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(`Choose ${role}...`)
            .addOptions(menuOptions);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect);

        const prompt = await interaction.followUp({
            content: `Pick the **${role}** for case ${caseId}.`,
            components: [row],
        });

        try {
            const selection = await prompt.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 60000,
                filter: (componentInteraction: any) =>
                    componentInteraction.user.id === interaction.user.id && componentInteraction.customId === customId,
            });

            const selectedId = selection.values[0];

            if (!selectedId) {
                await selection.update({
                    content: `No selection was made for ${role}.`,
                    components: [],
                });
                continue;
            }

            await assignRoleToCase({
                caseId,
                role,
                selectedId,
                assignedBy: interaction.user.id,
            });

            await selection.update({
                content: `${role} set to **${selectedId}**.`,
                components: [],
            });
        } catch {
            await prompt.edit({
                content: `Selection timed out for ${role}.`,
                components: [],
            });
        }
    }

    await interaction.followUp(`Role setup complete for case ${caseId}.`);
}
