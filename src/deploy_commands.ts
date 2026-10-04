import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import { fileNavig } from './misc/fileNavig.ts';
import type { IFolderContents } from './interfaces/IFolderContent.ts';

const commands = [];
const commandPath = 'commands';

const contents: IFolderContents[] = await fileNavig.getFolderContents(commandPath, '.ts');

for (const { folderPath, folderImport } of contents) {
    const command = folderImport.default || folderImport;

    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${folderPath} is missing a required "data" or "execute" property.`);
        for (const property in command) {
            console.log(`${folderPath} has property: ${property}`);
        }
    }
}

const token: string = process.env.DiscordToken ?? '';
const clientId: string = process.env.clientId ?? '';
const guildId: string = process.env.guildId ?? '';

const rest = new REST().setToken(token);

try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data: any = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId), 
        { body: commands }
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
    console.error('Error deploying commands:', error);
}
