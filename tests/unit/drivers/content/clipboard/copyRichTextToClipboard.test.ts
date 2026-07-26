import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyRichTextToClipboard } from '@/drivers/content/clipboard/copyRichTextToClipboard';

const originalClipboard = navigator.clipboard;
const originalClipboardItem = (window as Window & { ClipboardItem?: unknown }).ClipboardItem;
const originalExecCommand = document.execCommand;

function readBlob(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
        reader.addEventListener('error', () => reject(reader.error));
        reader.readAsText(blob);
    });
}

afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
    Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: originalClipboardItem });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
});

describe('copyRichTextToClipboard', () => {
    it('writes standard HTML and plain text together through ClipboardItem', async () => {
        const write = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });
        const clipboardData = new Map<string, string>();
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: vi.fn(() => {
                const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
                Object.defineProperty(event, 'clipboardData', {
                    configurable: true,
                    value: {
                        clearData: () => clipboardData.clear(),
                        setData: (type: string, value: string) => clipboardData.set(type, value),
                    },
                });
                document.body.dispatchEvent(event);
                return true;
            }),
        });

        const result = await copyRichTextToClipboard({
            html: '<p><strong>Answer</strong></p>',
            plainText: '**Answer**',
        });

        expect(result).toEqual({ ok: true, mode: 'rich' });
        expect(write).toHaveBeenCalledTimes(1);
        expect(document.execCommand).not.toHaveBeenCalled();
        expect(clipboardData.size).toBe(0);
        const item = (ClipboardItemStub as any).mock.instances[0];
        expect(Object.keys(item.items)).toEqual(['text/html', 'text/plain']);
        expect(await readBlob(item.items['text/html'])).toContain('<strong>Answer</strong>');
        expect(await readBlob(item.items['text/plain'])).toBe('**Answer**');
    });

    it('does not silently fall back to plain text when rich writes are unavailable', async () => {
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: undefined });

        const result = await copyRichTextToClipboard({
            html: '<p>Answer</p>',
            plainText: 'Answer',
        });

        expect(result).toEqual({ ok: false, reason: 'unsupported' });
        expect(writeText).not.toHaveBeenCalled();
    });

    it('can explicitly opt into plain-text fallback when a rich write is rejected', async () => {
        const write = vi.fn(async () => { throw new DOMException('Permission denied', 'NotAllowedError'); });
        const writeText = vi.fn(async () => undefined);
        const ClipboardItemStub = vi.fn(function ClipboardItem(this: any, items: Record<string, Blob>) {
            this.items = items;
        });
        (ClipboardItemStub as any).supports = vi.fn(() => true);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write, writeText } });
        Object.defineProperty(window, 'ClipboardItem', { configurable: true, value: ClipboardItemStub });

        const result = await copyRichTextToClipboard({
            html: '<p>Answer</p>',
            plainText: 'Answer',
            allowPlainTextFallback: true,
        });

        expect(result).toEqual({ ok: true, mode: 'plain-fallback' });
        expect(write).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith('Answer');
    });
});
