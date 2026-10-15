import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HighlightEntry } from '@/contracts/highlights';
const saved = vi.hoisted(() => ({ entries: [] as HighlightEntry[] }));
vi.mock('@/drivers/shared/clients/highlightsClient', () => ({ highlightsClient: {
    list: vi.fn(async () => saved.entries), subscribe: vi.fn(() => () => undefined),
    create: vi.fn(async (document, highlight) => { const entry = { document, highlight }; saved.entries = [entry]; return entry; }),
} }));
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

afterEach(() => { vi.restoreAllMocks(); document.querySelector('#aimd-reader-panel-host')?.remove(); saved.entries = []; });
describe('Reader mixed highlights', () => {
    it('saves from the selection swatch and restores table/prose fragments on reopening', async () => {
        const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
        Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [{ left: 10, top: 20, width: 80, height: 18, right: 90, bottom: 38 }] });
        const panel = new ReaderPanel();
        const items = [{ id: 'chatgpt-a1', userPrompt: 'Q', content: 'Before\n\n| A | B |\n| - | - |\n| Cell A | Cell B |\n\n```python\nexcluded_code\n```\n\nAfter', meta: { platformId: 'chatgpt', assistantMessageId: 'a1' } }];
        const options = { annotationDocument: { platform: 'chatgpt' as const, conversationId: 'mixed-test' } };
        try {
            await panel.show(items, 0, 'light', options);
            const shadow = document.querySelector('#aimd-reader-panel-host')!.shadowRoot!;
            const root = shadow.querySelector<HTMLElement>('.reader-markdown')!;
            const range = document.createRange(); range.selectNodeContents(root);
            const selection = { rangeCount: 1, getRangeAt: () => range, getComposedRanges: () => [{ startContainer: range.startContainer, startOffset: range.startOffset, endContainer: range.endContainer, endOffset: range.endOffset }], toString: () => range.toString() } as unknown as Selection;
            vi.spyOn(window, 'getSelection').mockReturnValue(selection);
            document.dispatchEvent(new Event('selectionchange'));
            await vi.waitFor(() => expect(shadow.querySelector('[data-action="highlight-selection"]')).toBeTruthy());
            const swatch = shadow.querySelector<HTMLButtonElement>('[data-action="highlight-selection"][data-color="blue"]')!;
            swatch.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, cancelable: true })); swatch.click();
            await vi.waitFor(() => expect(saved.entries).toHaveLength(1));
            expect(saved.entries[0]!.highlight.fragments?.map(fragment => fragment.quoteText)).toEqual(['Before', 'A', 'B', 'Cell A', 'Cell B', 'After']);
            expect(saved.entries[0]!.highlight.sourceMarkdown).not.toContain('excluded_code');
            await vi.waitFor(() => expect(shadow.querySelectorAll('.reader-text-highlights .reader-comment-highlight').length).toBeGreaterThan(0));
            panel.hide();
            await panel.show(items, 0, 'light', options);
            await vi.waitFor(() => expect(document.querySelector('#aimd-reader-panel-host')!.shadowRoot!.querySelectorAll('.reader-text-highlights .reader-comment-highlight').length).toBeGreaterThan(0));
        } finally {
            panel.hide();
            if (original) Object.defineProperty(Range.prototype, 'getClientRects', original); else delete (Range.prototype as any).getClientRects;
        }
    });
});
