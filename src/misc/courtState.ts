import fs from 'node:fs/promises';
import path from 'node:path';

export type CourtRole = 'witness' | 'defendant' | 'jury' | 'attorney' | 'plaintiff' | 'judge';

type TranscriptSource = 'system' | 'message';

interface TranscriptEntry {
    timestamp: string;
    source: TranscriptSource;
    content: string;
    actorId?: string;
    actorName?: string;
}

interface CourtParticipant {
    id: string;
    name: string;
}

interface CourtCase {
    caseId: string;
    guildId: string;
    channelId: string;
    createdBy: string;
    createdAt: string;
    participants: CourtParticipant[];
    roles: Partial<Record<CourtRole, string>>;
    transcript: TranscriptEntry[];
}

interface CourtData {
    cases: CourtCase[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'court-data.json');

let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureStore() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
        await fs.access(DATA_FILE);
    } catch {
        await fs.writeFile(DATA_FILE, JSON.stringify({ cases: [] }, null, 2), 'utf8');
    }
}

async function readStore(): Promise<CourtData> {
    await ensureStore();

    const raw = await fs.readFile(DATA_FILE, 'utf8');

    try {
        const parsed = JSON.parse(raw) as Partial<CourtData>;

        if (!parsed || !Array.isArray(parsed.cases)) {
            return { cases: [] };
        }

        return { cases: parsed.cases };
    } catch {
        return { cases: [] };
    }
}

async function writeStore(data: CourtData) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function withStoreLock<T>(updater: (data: CourtData) => T | Promise<T>): Promise<T> {
    const work = async () => {
        const data = await readStore();
        const result = await updater(data);
        await writeStore(data);
        return result;
    };

    const next = writeQueue.then(work, work);
    writeQueue = next.then(() => undefined, () => undefined);

    return next;
}

export async function createCourtCase(input: {
    guildId: string;
    channelId: string;
    createdBy: string;
    participants: CourtParticipant[];
}) {
    return withStoreLock((data) => {
        const caseId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const createdAt = new Date().toISOString();

        data.cases.push({
            caseId,
            guildId: input.guildId,
            channelId: input.channelId,
            createdBy: input.createdBy,
            createdAt,
            participants: input.participants,
            roles: {},
            transcript: [
                {
                    timestamp: createdAt,
                    source: 'system',
                    content: `Court case created by ${input.createdBy}.`,
                },
            ],
        });

        return caseId;
    });
}

export async function assignRoleToCase(input: {
    caseId: string;
    role: CourtRole;
    selectedId: string;
    assignedBy: string;
}) {
    return withStoreLock((data) => {
        const courtCase = data.cases.find((current) => current.caseId === input.caseId);

        if (!courtCase) {
            return false;
        }

        courtCase.roles[input.role] = input.selectedId;
        courtCase.transcript.push({
            timestamp: new Date().toISOString(),
            source: 'system',
            content: `${input.assignedBy} assigned ${input.role} to ${input.selectedId}.`,
        });

        return true;
    });
}

export async function appendTranscriptByChannel(channelId: string, entry: Omit<TranscriptEntry, 'timestamp'>) {
    return withStoreLock((data) => {
        const matchingCases = data.cases.filter((current) => current.channelId === channelId);

        if (matchingCases.length === 0) {
            return false;
        }

        const latestCase = matchingCases[matchingCases.length - 1];

        if (!latestCase) {
            return false;
        }

        latestCase.transcript.push({
            timestamp: new Date().toISOString(),
            ...entry,
        });

        return true;
    });
}

export async function updateParticipantName(input: {
    caseId: string;
    userId: string;
    newName: string;
}) {
    return withStoreLock((data) => {
        const courtCase = data.cases.find((current) => current.caseId === input.caseId);

        if (!courtCase) {
            return false;
        }

        const participant = courtCase.participants.find((current) => current.id === input.userId);

        if (!participant) {
            return false;
        }

        participant.name = input.newName;
        courtCase.transcript.push({
            timestamp: new Date().toISOString(),
            source: 'system',
            content: `Updated participant ${input.userId} name to ${input.newName}.`,
        });

        return true;
    });
}
