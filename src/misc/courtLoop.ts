import {
     ChannelType,
     Guild, 
     ActionRowBuilder, 
     StringSelectMenuBuilder, 
     StringSelectMenuOptionBuilder,  
    } from "discord.js";
export async function createDiscordChannel(interaction: any) {
    let channel;

    try {
        await interaction.guild.channels.create({
            name: `court-case-${interaction.user.id}`,
            type: ChannelType.GuildText
        })
    } 
    catch(error) {
        console.error("there was an error" + error);
        return null;
    }

    return channel;
}

// ask the owner of the match who will be what based on the available players.
export async function getRolesInfo(interaction: any, users: string[]) {

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
    
    const WitnessSelect = new StringSelectMenuBuilder()
        .setCustomId('custom_witness_select')
        .setPlaceholder('Choose a Witness from the list...')
        .addOptions(menuOptions);
    
    const DefendantSelect = new StringSelectMenuBuilder()
        .setCustomId('custom_Defendant_select')
        .setPlaceholder('Choose a Defendant from the list...')
        .addOptions(menuOptions);

    const JurySelect = new StringSelectMenuBuilder()
        .setCustomId('custom_Jury_select')
        .setPlaceholder('Choose a Jury from the list...')
        .addOptions(menuOptions);

    const AttorneysSelect = new StringSelectMenuBuilder()
        .setCustomId('custom_Attorneys_select')
        .setPlaceholder('Choose an Attorney from the list...')
        .addOptions(menuOptions);

    const PlaintiffSelect = new StringSelectMenuBuilder()
        .setCustomId('custom_Plaintiff_select')
        .setPlaceholder('Choose a Plaintiff from the list...')
        .addOptions(menuOptions);

    
}