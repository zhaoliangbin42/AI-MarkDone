import { copyRichTextToClipboard } from './copyRichTextToClipboard';

export type ClipboardMathmlWriteResult =
    | { ok: true }
    | {
        ok: false;
        reason: 'empty' | 'write_failed';
        errorName?: string;
        errorMessage?: string;
    };

export function htmlDocumentForMathml(mathml: string): string {
    return `<!doctype html><html><body>${mathml}</body></html>`;
}

export async function copyMathmlToClipboard(mathml: string): Promise<ClipboardMathmlWriteResult> {
    const source = mathml.trim();
    if (!source) return { ok: false, reason: 'empty' };
    const result = await copyRichTextToClipboard({
        html: htmlDocumentForMathml(source),
        plainText: source,
        allowPlainTextFallback: true,
    });
    if (result.ok) return { ok: true };
    return {
        ok: false,
        reason: result.reason === 'empty' ? 'empty' : 'write_failed',
        errorName: result.errorName,
        errorMessage: result.errorMessage,
    };
}
