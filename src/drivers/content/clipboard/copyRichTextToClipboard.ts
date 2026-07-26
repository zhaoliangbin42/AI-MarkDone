import { copyTextToClipboard } from './clipboard';

export type RichTextClipboardWriteResult =
    | { ok: true; mode: 'rich' | 'plain-fallback' }
    | {
        ok: false;
        reason: 'empty' | 'unsupported' | 'write_failed';
        errorName?: string;
        errorMessage?: string;
    };

type ClipboardItemConstructor = typeof ClipboardItem & {
    supports?: (type: string) => boolean;
};

function getClipboardItemConstructor(): ClipboardItemConstructor | undefined {
    return (window as Window & { ClipboardItem?: ClipboardItemConstructor }).ClipboardItem;
}

export async function copyRichTextToClipboard(params: {
    html: string;
    plainText?: string;
    allowPlainTextFallback?: boolean;
}): Promise<RichTextClipboardWriteResult> {
    const html = params.html.trim();
    const plainText = params.plainText?.trim() ?? '';
    if (!html && !plainText) return { ok: false, reason: 'empty' };
    const clipboard = navigator.clipboard as Clipboard | undefined;
    const ClipboardItemCtor = getClipboardItemConstructor();
    const supportsHtml = ClipboardItemCtor
        && (typeof ClipboardItemCtor.supports !== 'function' || ClipboardItemCtor.supports('text/html'));

    if (clipboard?.write && ClipboardItemCtor && supportsHtml && html) {
        try {
            const representations: Record<string, Blob> = {
                'text/html': new Blob([html], { type: 'text/html' }),
            };
            if (plainText) {
                representations['text/plain'] = new Blob([plainText], { type: 'text/plain' });
            }
            await clipboard.write([
                new ClipboardItemCtor(representations),
            ]);
            return { ok: true, mode: 'rich' };
        } catch {
            // Only callers that explicitly supplied plainText may use the
            // text-only fallback below. HTML-only callers fail without downgrade.
        }
    }

    if (html && copyRichTextThroughNativeEvent({ html, plainText })) {
        return { ok: true, mode: 'rich' };
    }

    if (!params.allowPlainTextFallback || !plainText) return { ok: false, reason: 'unsupported' };
    const plainCopied = await copyTextToClipboard(plainText);
    if (plainCopied) return { ok: true, mode: 'plain-fallback' };
    return { ok: false, reason: 'write_failed' };
}

function copyRichTextThroughNativeEvent(params: {
    html: string;
    plainText: string;
}): boolean {
    if (typeof document.execCommand !== 'function') return false;
    let wroteClipboardData = false;
    const onCopy = (event: ClipboardEvent): void => {
        if (!event.clipboardData) return;
        try {
            event.clipboardData.clearData();
            event.clipboardData.setData('text/html', params.html);
            if (params.plainText) {
                event.clipboardData.setData('text/plain', params.plainText);
            }
            event.preventDefault();
            wroteClipboardData = true;
        } catch {
            wroteClipboardData = false;
        }
    };

    window.addEventListener('copy', onCopy, { once: true });
    try {
        document.execCommand('copy');
    } catch {
        return false;
    } finally {
        window.removeEventListener('copy', onCopy);
    }
    return wroteClipboardData;
}
