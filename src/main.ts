import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { fileNavig } from './misc/fileNavig.ts';
import type { IFolderContents } from './interfaces/IFolderContent.ts';
import { appendTranscriptByChannel } from './misc/courtState.ts';

export const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages],
});

client.once('clientReady', () => {
    if (client.user != null) {
        console.log(`Logged in as ${client.user.tag}`);
    }
});

client.commands = new Collection();

const commandPath = 'commands';

const contents: IFolderContents[] = await fileNavig.getFolderContents(commandPath, '.ts');

for (const { folderPath, folderImport } of contents) {
    const command = folderImport.default || folderImport;

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${folderPath} is missing a required "data" or "execute" property.`);

        for (const property in command) {
            console.log(`${folderPath} has property: ${property}`);
        }
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'There was an error while executing this command!',
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        return;
    }

    const attachmentUrls = [...message.attachments.values()].map((attachment) => attachment.url);
    const textContent = message.content.trim();
    const content = [textContent, ...attachmentUrls].filter(Boolean).join('\n') || '[no text content]';

    await appendTranscriptByChannel(message.channelId, {
        source: 'message',
        actorId: message.author.id,
        actorName: message.member?.displayName ?? message.author.username,
        content,
    });
});

client.login(process.env.DiscordToken);
