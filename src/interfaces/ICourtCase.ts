export type CaseParticipantKind = 'human' | 'ai';

export interface CaseParticipant {
    kind: CaseParticipantKind;
    name: string | null;
    userId?: string;
}

export interface CourtCaseRoles {
    judge: CaseParticipant;
    plaintiff: CaseParticipant | null;
    defendant: CaseParticipant | null;
    attorneys: CaseParticipant[];
    witnesses: CaseParticipant[];
    jury: CaseParticipant[];
}

export interface CourtCase {
    caseId: string;
    title: string;
    description: string;
    status: 'setup' | 'in-progress' | 'closed';
    createdAt: string;
    updatedAt: string;
    participants: CaseParticipant[];
    roles: CourtCaseRoles;
    transcriptFile: string;
}

export interface TranscriptEntry {
    timestamp: string;
    speaker: CaseParticipantKind | 'system';
    name: string;
    role?: string;
    content: string;
}