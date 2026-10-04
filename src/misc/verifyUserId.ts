export async function isMemberInServer(guild: any, userId: string): Promise<boolean> {
    try {
        const member = await guild.members.fetch(userId);
        return true; // Returns true if they are in the server
    } catch {
        return false; // Returns false if they aren't in the server
    }
}