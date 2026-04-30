export type ClipboardSvgWriteResult =
    | { ok: true }
    | {
        ok: false;
        reason: 'unsupported' | 'invalid_blob' | 'write_failed';
        errorName?: string;
        errorMessage?: string;
    };

export async function copySvgBlobToClipboard(blob: Blob): Promise<ClipboardSvgWriteResult> {
    if (!(blob instanceof Blob) || blob.type !== 'image/svg+xml') {
        return { ok: false, reason: 'invalid_blob' };
    }

    const clipboard = navigator.clipboard as Clipboard | undefined;
    const ClipboardItemCtor = (window as Window & {
        ClipboardItem?: typeof ClipboardItem & { supports?: (type: string) => boolean };
    }).ClipboardItem;
    if (!clipboard?.write || !ClipboardItemCtor) {
        return { ok: false, reason: 'unsupported' };
    }

    if (typeof ClipboardItemCtor.supports === 'function' && !ClipboardItemCtor.supports('image/svg+xml')) {
        return { ok: false, reason: 'unsupported' };
    }

    try {
        await clipboard.write([
            new ClipboardItemCtor({
                'image/svg+xml': blob,
            }),
        ]);
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
