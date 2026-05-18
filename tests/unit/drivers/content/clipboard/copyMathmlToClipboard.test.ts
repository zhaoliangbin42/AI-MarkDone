import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyMathmlToClipboard } from '@/drivers/content/clipboard/copyMathmlToClipboard';

function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
        reader.addEventListener('error', () => reject(reader.error));
        reader.readAsText(blob);
    });
}

describe('copyMathmlToClipboard', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('writes plain text and HTML MathML payloads when rich clipboard writes are available', async () => {
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        } as any);
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        vi.stubGlobal('navigator', {
            clipboard: { write, writeText: vi.fn() },
        } as any);
        vi.stubGlobal('window', {
            ClipboardItem: ClipboardItemStub,
        } as any);

        const result = await copyMathmlToClipboard('<math><mi>x</mi></math>');

        expect(result).toEqual({ ok: true });
        expect(ClipboardItemStub).toHaveBeenCalledTimes(1);
        const items = vi.mocked(ClipboardItemStub).mock.calls[0]?.[0] as Record<string, Blob>;
        expect(Object.keys(items).sort()).toEqual(['text/html', 'text/plain']);
        expect(await readBlob(items['text/plain']!)).toBe('<math><mi>x</mi></math>');
        expect(await readBlob(items['text/html']!)).toContain('<body><math><mi>x</mi></math></body>');
        expect(write).toHaveBeenCalledTimes(1);
    });

    it('falls back to text-only clipboard copy when rich clipboard write fails', async () => {
        const writeText = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        } as any);
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        vi.stubGlobal('navigator', {
            clipboard: {
                write: vi.fn(async () => {
                    throw new DOMException('Denied', 'NotAllowedError');
                }),
                writeText,
            },
        } as any);
        vi.stubGlobal('window', {
            ClipboardItem: ClipboardItemStub,
        } as any);

        const result = await copyMathmlToClipboard('<math><mi>y</mi></math>');

        expect(result).toEqual({ ok: true });
        expect(writeText).toHaveBeenCalledWith('<math><mi>y</mi></math>');
    });
});
