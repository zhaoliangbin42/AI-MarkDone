export type FolderRelocateJournalV1 = {
    v: 1;
    opId: string;
    type: 'folder_relocate';
    oldPath: string;
    newPath: string;
    startedAt: number;
};

export type BookmarksJournalRecord = FolderRelocateJournalV1;

export function createOpId(now: number): string {
    const rand = Math.random().toString(16).slice(2);
    return `op_${now.toString(16)}_${rand}`;
}

