export type RenderProgressEvent = {
    phase: 'preparing' | 'loading_assets' | 'rendering' | 'rendering_chunk' | 'stitching' | 'encoding' | 'done';
    completed?: number;
    total?: number;
};

export class RenderAbortError extends Error {
    constructor(message = 'Operation cancelled.') {
        super(message);
        this.name = 'AbortError';
    }
}

export function throwIfAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) return;
    throw new RenderAbortError();
}

export function isRenderAbortError(error: unknown): boolean {
    return error instanceof RenderAbortError
        || (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError');
}

export async function yieldToBrowser(signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    await new Promise<void>((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
            return;
        }
        window.setTimeout(resolve, 0);
    });
    throwIfAborted(signal);
}
