export type CopyPngDebugStage =
    | 'resolve_index'
    | 'collect_turns'
    | 'build_plan'
    | 'render_blob'
    | 'clipboard_write'
    | 'copy_done'
    | 'copy_error';

export type CopyPngDebugEvent = {
    stage: CopyPngDebugStage;
    durationMs: number;
    totalMs?: number;
    selectedIndex?: number | null;
    selectedCount?: number;
    turnCount?: number;
    assistantChars?: number;
    userChars?: number;
    htmlChars?: number;
    width?: number;
    height?: number;
    pixelRatio?: number;
    requestedPixelRatio?: number;
    effectivePixelRatio?: number;
    pixelArea?: number;
    capReason?: string;
    fontStatus?: string;
    strategy?: string;
    chunkCount?: number;
    maxChunkHeight?: number;
    fontEmbedMode?: string;
    blobBytes?: number;
    result?: string;
    errorCode?: string;
    errorMessage?: string;
};

export type CopyPngDebugSink = (event: CopyPngDebugEvent) => void;

export function isCopyPngDebugEnabled(): boolean {
    try {
        if (typeof (globalThis as any).__AIMD_COPY_PNG_DEBUG__ === 'boolean') {
            return Boolean((globalThis as any).__AIMD_COPY_PNG_DEBUG__);
        }
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('aimd:copy-png-debug') === '1'
                || localStorage.getItem('aimd:debug') === '1'
                || localStorage.getItem('aimd_debug') === '1';
        }
    } catch {
        // Debugging must never affect the production copy path.
    }
    return false;
}

export function nowMs(): number {
    try {
        return performance.now();
    } catch {
        return Date.now();
    }
}

export function logCopyPngDebugEvent(event: CopyPngDebugEvent): void {
    if (!isCopyPngDebugEnabled()) return;
    try {
        console.info('[AI-MarkDone][CopyPNG][Perf]', event);
    } catch {
        // ignore logging failures
    }
}
