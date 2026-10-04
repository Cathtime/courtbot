import fs from 'node:fs';
import path from 'node:path';
import type { IFolderContents } from '../interfaces/IFolderContent.ts';

export class fileNavig {
    static async getFolderContents(folderPath: string, fileExtension: string): Promise<IFolderContents[]> {
        const rootPath = path.join(process.cwd(), "/src/", folderPath);
        const results: IFolderContents[] = [];
        const visitedPaths = new Set<string>(); // Prevents infinite recursion

        async function scanDirectory(currentDir: string) {
            if (!fs.existsSync(currentDir) || visitedPaths.has(currentDir)) return;
            visitedPaths.add(currentDir);

            const items = fs.readdirSync(currentDir);

            for (const item of items) {
                const fullPath = path.join(currentDir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    await scanDirectory(fullPath);
                } else if (stat.isFile() && item.endsWith(fileExtension)) {
                    // Skip if we are accidentally importing the deploy script itself
                    if (fullPath.includes('deploy_commands.ts')) continue;

                    console.log(`[DEBUG] Safely importing: ${item}`);
                    const folderImport = await import(fullPath);
                    
                    results.push({
                        folderPath: currentDir,
                        folderImport: folderImport
                    });
                }
            }
        }

        await scanDirectory(rootPath);

        if (results.length === 0) {
            throw new Error(`No files with extension "${fileExtension}" found in ${rootPath}`);
        }
        
        return results;
    }
}
