export type FoldingMode = 'off' | 'all' | 'keep_last_n';

export type ChatGPTFoldingSettings = {
    foldingMode: FoldingMode;
    defaultExpandedCount: number;
    showFoldDock: boolean;
};

export function normalizeFoldingMode(value: unknown): FoldingMode {
    return value === 'off' || value === 'all' || value === 'keep_last_n' ? value : 'off';
}

export function normalizeKeepLastN(value: unknown, fallback: number = 8): number {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(200, Math.floor(num)));
}

export function normalizeShowDock(value: unknown): boolean {
    return typeof value === 'boolean' ? value : true;
}

export function computeCollapsedGroupIndices(mode: FoldingMode, keepLastN: number, groupCount: number): Set<number> {
    if (groupCount <= 0) return new Set();
    if (mode === 'off') return new Set();
    if (mode === 'all') return new Set(Array.from({ length: groupCount }, (_, i) => i));

    const n = Math.max(0, Math.floor(keepLastN));
    const start = Math.max(0, groupCount - n);
    const collapsed = new Set<number>();
    for (let i = 0; i < start; i += 1) collapsed.add(i);
    return collapsed;
}

