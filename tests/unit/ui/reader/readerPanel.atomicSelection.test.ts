import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
}

describe('ReaderPanel atomic selection', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('highlights atomic units and copies markdown source on copy events', async () => {
        setClipboardMock();
        const panel = new ReaderPanel();

        await panel.show(
            [{
                id: 'a',
                userPrompt: 'Q1',
                content: 'Before `code` and $x+y$ after',
            }],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const markdownRoot = shadow.querySelector('.reader-markdown') as HTMLElement;
        expect(Array.from(markdownRoot.querySelectorAll('[data-aimd-unit-id]')).map((node) => (node as HTMLElement).dataset.aimdUnitKind)).toEqual([
            'inline-code',
            'inline-math',
        ]);
        const paragraph = markdownRoot.querySelector('p')!;
        const firstText = paragraph.firstChild as Text;
        const lastNode = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(lastNode, lastNode.textContent!.length);
        const selection = {
            rangeCount: 1,
            getRangeAt: () => range,
            getComposedRanges: () => [{
                startContainer: firstText,
                startOffset: 0,
                endContainer: lastNode,
                endOffset: lastNode.textContent!.length,
            }],
            toString: () => range.toString(),
        } as unknown as Selection;
        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(selection);
        (panel as any).syncAtomicSelection();

        const selectedUnits = Array.from(markdownRoot.querySelectorAll('[data-aimd-unit-state="selected"]'));
        expect(selectedUnits.map((node) => (node as HTMLElement).dataset.aimdUnitKind)).toEqual(['inline-code', 'inline-math']);

        const clipboardData = {
            values: new Map<string, string>(),
            setData(type: string, value: string) {
                this.values.set(type, value);
            },
        };
        const copyEvent = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
        Object.defineProperty(copyEvent, 'clipboardData', { value: clipboardData });
        (panel as any).handleAtomicCopy(copyEvent);

        expect(clipboardData.values.get('text/plain')).toContain('`code`');
        expect(clipboardData.values.get('text/plain')).toContain('$x+y$');
        getSelectionSpy.mockRestore();
    });
});
