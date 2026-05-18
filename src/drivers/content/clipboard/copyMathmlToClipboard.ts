export type ClipboardMathmlWriteResult =
    | { ok: true }
    | {
        ok: false;
        reason: 'empty' | 'write_failed';
        errorName?: string;
        errorMessage?: string;
    };

function htmlDocumentForMathml(mathml: string): string {
    return `<!doctype html><html><body>${mathml}</body></html>`;
}

export async function copyMathmlToClipboard(mathml: string): Promise<ClipboardMathmlWriteResult> {
    const source = mathml.trim();
    if (!source) return { ok: false, reason: 'empty' };

    const clipboard = navigator.clipboard as Clipboard | undefined;
    const ClipboardItemCtor = (window as Window & {
        ClipboardItem?: typeof ClipboardItem & { supports?: (type: string) => boolean };
    }).ClipboardItem;

    if (clipboard?.write && ClipboardItemCtor) {
        try {
            const items: Record<string, Blob> = {
                'text/plain': new Blob([source], { type: 'text/plain' }),
            };
            if (typeof ClipboardItemCtor.supports !== 'function' || ClipboardItemCtor.supports('text/html')) {
                items['text/html'] = new Blob([htmlDocumentForMathml(source)], { type: 'text/html' });
            }
            await clipboard.write([new ClipboardItemCtor(items)]);
            return { ok: true };
        } catch (error: any) {
            // Fall through to text-only copy for browsers that reject rich clipboard writes.
        }
    }

    try {
        await navigator.clipboard.writeText(source);
        return { ok: true };
    } catch (error: any) {
        return {
            ok: false,
            reason: 'write_failed',
            errorName: typeof error?.name === 'string' ? error.name : undefined,
            errorMessage: typeof error?.message === 'string' ? error.message : undefined,
        };
    }
}
