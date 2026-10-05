import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { CourtCase, TranscriptEntry } from '../interfaces/ICourtCase.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const casesRoot = path.join(projectRoot, 'data', 'cases');

function caseDirectory(caseId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(caseId)) {
        throw new Error(`Invalid case id: ${caseId}`);
    }

    return path.join(casesRoot, caseId);
}

export function getCaseFilePath(caseId: string): string {
    return path.join(caseDirectory(caseId), 'case.json');
}

function transcriptFileName(transcriptFile: string): string {
    if (path.basename(transcriptFile) !== transcriptFile || path.isAbsolute(transcriptFile)) {
        throw new Error(`Invalid transcript file: ${transcriptFile}`);
    }

    return transcriptFile;
}

export function getTranscriptFilePath(caseId: string, transcriptFile = 'transcript.jsonl'): string {
    return path.join(caseDirectory(caseId), transcriptFileName(transcriptFile));
}

export async function saveCourtCase(courtCase: CourtCase): Promise<void> {
    const directory = caseDirectory(courtCase.caseId);
    await mkdir(directory, { recursive: true });

    const updatedCase: CourtCase = {
        ...courtCase,
        updatedAt: new Date().toISOString(),
    };
    const temporaryFile = `${getCaseFilePath(courtCase.caseId)}.tmp`;

    await writeFile(temporaryFile, `${JSON.stringify(updatedCase, null, 2)}\n`, 'utf8');
    await rename(temporaryFile, getCaseFilePath(courtCase.caseId));
}

export async function loadCourtCase(caseId: string): Promise<CourtCase> {
    const contents = await readFile(getCaseFilePath(caseId), 'utf8');
    return JSON.parse(contents) as CourtCase;
}

export async function appendTranscriptEntry(caseId: string, entry: TranscriptEntry): Promise<void> {
    await mkdir(caseDirectory(caseId), { recursive: true });
    const courtCase = await loadCourtCase(caseId);
    await appendFile(getTranscriptFilePath(caseId, courtCase.transcriptFile), `${JSON.stringify(entry)}\n`, 'utf8');
}

export async function loadTranscript(caseId: string): Promise<TranscriptEntry[]> {
    const courtCase = await loadCourtCase(caseId);

    try {
        const contents = await readFile(getTranscriptFilePath(caseId, courtCase.transcriptFile), 'utf8');
        return contents
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line) as TranscriptEntry);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

export async function getTranscriptContext(caseId: string): Promise<string> {
    const entries = await loadTranscript(caseId);
    return entries
        .map((entry) => `[${entry.timestamp}] ${entry.role ? `${entry.role} ` : ''}${entry.name}: ${entry.content}`)
        .join('\n');
}