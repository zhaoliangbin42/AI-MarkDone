import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

function createSelection(range: Range): Selection {
    return {
        rangeCount: 1,
        getRangeAt: () => range,
        toString: () => range.toString(),
    } as unknown as Selection;
}

function installSelectionLayout(range: Range, markdownRoot: HTMLElement, unitElements: HTMLElement[]): void {
    Object.assign(range, {
        getClientRects: () => ([
            { left: 20, top: 20, width: 180, height: 20, right: 200, bottom: 40, x: 20, y: 20, toJSON: () => ({}) },
        ]),
    });
    Object.assign(markdownRoot, {
        getBoundingClientRect: () => ({
            left: 0, top: 0, width: 760, height: 360, right: 760, bottom: 360, x: 0, y: 0, toJSON: () => ({}),
        }),
    });
    unitElements.forEach((element, index) => {
        Object.assign(element, {
            getBoundingClientRect: () => ({
                left: 90 + index * 40,
                top: 20,
                width: 34,
                height: 20,
                right: 124 + index * 40,
                bottom: 40,
                x: 90 + index * 40,
                y: 20,
                toJSON: () => ({}),
            }),
        });
    });
}

function selectParagraph(shadow: ShadowRoot): () => void {
    const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown')!;
    const paragraph = markdownRoot.querySelector('p')!;
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let current = walker.nextNode();
    while (current) {
        const text = current as Text;
        if (text.data.trim()) textNodes.push(text);
        current = walker.nextNode();
    }
    const firstText = textNodes[0]!;
    const lastText = textNodes[textNodes.length - 1]!;
    const range = document.createRange();
    range.setStart(firstText, 0);
    range.setEnd(lastText, lastText.data.length);
    Object.assign(range, {
        toString: () => paragraph.textContent ?? '',
    });
    installSelectionLayout(range, markdownRoot, Array.from(markdownRoot.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')));
    const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
    document.dispatchEvent(new Event('selectionchange'));
    return () => getSelectionSpy.mockRestore();
}

describe('ReaderPanel Sticky workspace', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('adds the selected markdown as a rendered sticky block and keeps it while paging', async () => {
        const panel = new ReaderPanel();
        await panel.show(
            [
                { id: 'a', userPrompt: 'Q1', content: 'Important definition $x+y$' },
                { id: 'b', userPrompt: 'Q2', content: 'Later derivation' },
            ],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const restoreSelection = selectParagraph(shadow);
        await Promise.resolve();

        const actionButtons = shadow.querySelectorAll<HTMLButtonElement>('.reader-comment-action__button');
        expect(actionButtons).toHaveLength(3);
        const stickButton = shadow.querySelector<HTMLButtonElement>('[data-action="reader-selection-stick"]')!;
        stickButton.click();
        await Promise.resolve();

        const stickyPanel = shadow.querySelector<HTMLElement>('.reader-sticky-panel');
        const stickyBlocks = shadow.querySelectorAll<HTMLElement>('.reader-sticky-block');
        expect(stickyPanel?.dataset.open).toBe('1');
        expect(shadow.querySelector('[data-action="reader-sticky-toggle"]')?.closest('.reader-footer__left')).toBeTruthy();
        expect(shadow.querySelector('.reader-sticky-toggle')).toBeNull();
        expect(stickyBlocks).toHaveLength(1);
        expect(stickyBlocks[0]?.textContent).toContain('Important definition');
        expect(stickyBlocks[0]?.querySelector('.katex')).toBeTruthy();
        expect(stickyBlocks[0]?.querySelector('[data-action="reader-sticky-drag"]')).toBeTruthy();
        expect(stickyBlocks[0]?.querySelector('[data-action="reader-sticky-delete"]')).toBeTruthy();
        expect(stickyBlocks[0]?.querySelector('[data-action="reader-sticky-move-up"]')).toBeNull();
        expect(stickyBlocks[0]?.querySelector('[data-action="reader-sticky-move-down"]')).toBeNull();

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(shadow.querySelector<HTMLElement>('.reader-markdown')?.textContent).toContain('Later derivation');
        expect(shadow.querySelectorAll<HTMLElement>('.reader-sticky-block')).toHaveLength(1);
        expect(shadow.querySelector<HTMLElement>('.reader-sticky-block')?.textContent).toContain('Important definition');

        restoreSelection();
    });

    it('deletes and reorders sticky blocks without changing the current reader page', async () => {
        const panel = new ReaderPanel();
        await panel.show(
            [
                { id: 'a', userPrompt: 'Q1', content: 'Alpha $a$ note' },
                { id: 'b', userPrompt: 'Q2', content: 'Beta $b$ note' },
            ],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;

        let restoreSelection = selectParagraph(shadow);
        await Promise.resolve();
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-selection-stick"]')!.click();
        await Promise.resolve();
        restoreSelection();

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        restoreSelection = selectParagraph(shadow);
        await Promise.resolve();
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-selection-stick"]')!.click();
        await Promise.resolve();
        restoreSelection();

        let blocks = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-sticky-block'));
        expect(blocks.map((block) => block.textContent)).toEqual([
            expect.stringContaining('Alpha'),
            expect.stringContaining('Beta'),
        ]);

        blocks.forEach((block, index) => {
            Object.assign(block, {
                getBoundingClientRect: () => ({
                    left: 0,
                    top: index * 80,
                    width: 280,
                    height: 64,
                    right: 280,
                    bottom: index * 80 + 64,
                    x: 0,
                    y: index * 80,
                    toJSON: () => ({}),
                }),
            });
        });
        blocks[0]!.querySelector<HTMLButtonElement>('[data-action="reader-sticky-drag"]')!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 12,
            clientY: 12,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 12,
            clientY: 120,
        }));
        document.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            clientX: 12,
            clientY: 120,
        }));
        await Promise.resolve();

        blocks = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-sticky-block'));
        expect(blocks.map((block) => block.textContent)).toEqual([
            expect.stringContaining('Beta'),
            expect.stringContaining('Alpha'),
        ]);

        expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('2/2');

        blocks[0]!.querySelector<HTMLButtonElement>('[data-action="reader-sticky-delete"]')!.click();
        await Promise.resolve();

        blocks = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-sticky-block'));
        expect(blocks).toHaveLength(1);
        expect(blocks[0]?.textContent).toContain('Alpha');
    });

    it('keeps sticky blocks after closing and reopening the reader in the same page lifecycle', async () => {
        const panel = new ReaderPanel();
        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Persistent $p$ note' }],
            0,
            'light',
        );

        let host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        let shadow = host.shadowRoot as ShadowRoot;
        const restoreSelection = selectParagraph(shadow);
        await Promise.resolve();

        shadow.querySelector<HTMLButtonElement>('[data-action="reader-selection-stick"]')!.click();
        await Promise.resolve();
        restoreSelection();

        panel.hide();
        shadow.querySelector<HTMLElement>('.panel-window--reader')?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await Promise.resolve();

        await panel.show(
            [{ id: 'b', userPrompt: 'Q2', content: 'Fresh page content' }],
            0,
            'light',
        );

        host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        shadow = host.shadowRoot as ShadowRoot;
        const stickyBlocks = shadow.querySelectorAll<HTMLElement>('.reader-sticky-block');
        expect(stickyBlocks).toHaveLength(1);
        expect(stickyBlocks[0]?.textContent).toContain('Persistent');
    });

    it('allows the sticky workspace to resize up to two thirds of the reader body width', async () => {
        const panel = new ReaderPanel();
        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Wide sticky content' }],
            0,
            'light',
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const bodyWrap = shadow.querySelector<HTMLElement>('.reader-body-wrap')!;
        Object.assign(bodyWrap, {
            getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                width: 1200,
                height: 720,
                right: 1200,
                bottom: 720,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        });

        const resizeHandle = shadow.querySelector<HTMLElement>('[data-action="reader-sticky-resize"]')!;
        resizeHandle.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            clientX: 320,
            clientY: 24,
        }));
        document.dispatchEvent(new MouseEvent('pointermove', {
            bubbles: true,
            clientX: 1600,
            clientY: 24,
        }));
        document.dispatchEvent(new MouseEvent('pointerup', {
            bubbles: true,
            clientX: 1600,
            clientY: 24,
        }));
        await Promise.resolve();

        expect(shadow.querySelector<HTMLElement>('.reader-sticky-panel')?.style.getPropertyValue('--_reader-sticky-width')).toBe('800px');
    });

    it('does not render the sticky workspace for bookmark preview profile', async () => {
        const panel = new ReaderPanel();
        await panel.show(
            [{ id: 'a', userPrompt: 'Q1', content: 'Preview content' }],
            0,
            'light',
            { profile: 'bookmark-preview' },
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        selectParagraph(shadow);
        await Promise.resolve();

        expect(shadow.querySelector('.reader-sticky-panel')).toBeNull();
        expect(shadow.querySelector('[data-action="reader-selection-stick"]')).toBeNull();
    });
});
