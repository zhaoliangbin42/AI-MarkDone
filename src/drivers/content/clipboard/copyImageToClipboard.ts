export type ClipboardImageWriteResult =
    | { ok: true }
    | {
        ok: false;
        reason: 'unsupported' | 'invalid_blob' | 'write_failed';
        errorName?: string;
        errorMessage?: string;
    };

export async function copyImageBlobToClipboard(blob: Blob): Promise<ClipboardImageWriteResult> {
    if (!(blob instanceof Blob) || blob.type !== 'image/png') {
        return { ok: false, reason: 'invalid_blob' };
    }

    const clipboard = navigator.clipboard as Clipboard | undefined;
    const ClipboardItemCtor = (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!clipboard?.write || !ClipboardItemCtor) {
        return { ok: false, reason: 'unsupported' };
    }

    try {
        await clipboard.write([
            new ClipboardItemCtor({
                'image/png': blob,
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
