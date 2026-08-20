import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

type LayoutMetrics = {
    scrollHeight: number;
    clientHeight: number;
};

const layoutMetrics: LayoutMetrics = {
    scrollHeight: 0,
    clientHeight: 0,
};

let originalScrollHeight: PropertyDescriptor | undefined;
let originalClientHeight: PropertyDescriptor | undefined;
let originalScrollTop: PropertyDescriptor | undefined;
const scrollTopByElement = new WeakMap<Element, number>();

function installLayoutMetrics(): void {
    originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    originalScrollTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');

    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get: () => layoutMetrics.scrollHeight,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get: () => layoutMetrics.clientHeight,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
        configurable: true,
        get() {
            return scrollTopByElement.get(this) ?? 0;
        },
        set(value: number) {
            scrollTopByElement.set(this, Number(value));
        },
    });
}

function restoreLayoutMetrics(): void {
    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollHeight;
    if (originalClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).clientHeight;
    if (originalScrollTop) Object.defineProperty(HTMLElement.prototype, 'scrollTop', originalScrollTop);
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTop;
}

function setLayout(scrollHeight: number, clientHeight: number): void {
    layoutMetrics.scrollHeight = scrollHeight;
    layoutMetrics.clientHeight = clientHeight;
}

function readerItems() {
    return [
        { id: 'assistant-a', userPrompt: 'Question A', content: 'Content A' },
        { id: 'assistant-b', userPrompt: 'Question B', content: 'Content B' },
    ];
}

function getReaderBody(panel: ReaderPanel): HTMLElement {
    const host = document.querySelector<HTMLElement>('#aimd-reader-panel-host');
    const body = host?.shadowRoot?.querySelector<HTMLElement>('.reader-body');
    if (!body) throw new Error(`Reader body is not mounted for ${panel.constructor.name}`);
    return body;
}

function clickReaderAction(action: string): void {
    const host = document.querySelector<HTMLElement>('#aimd-reader-panel-host');
    host?.shadowRoot?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
}

async function flushReaderRender(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function closePanel(panel: ReaderPanel): void {
    panel.hide();
    const host = document.querySelector<HTMLElement>('#aimd-reader-panel-host');
    host?.shadowRoot?.querySelector<HTMLElement>('.panel-window')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
}

describe('ReaderPanel page-lifecycle scroll position', () => {
    beforeEach(() => {
        installLayoutMetrics();
        setLayout(2000, 500);
    });

    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
        restoreLayoutMetrics();
        layoutMetrics.scrollHeight = 0;
        layoutMetrics.clientHeight = 0;
    });

    it('restores an approximate position independently for each reader item', async () => {
        const panel = new ReaderPanel();
        const items = readerItems();
        await panel.show(items, 0, 'light', { profile: 'conversation-reader' });

        const firstBody = getReaderBody(panel);
        firstBody.scrollTop = 750;
        firstBody.dispatchEvent(new Event('scroll'));

        setLayout(2000, 500);
        clickReaderAction('reader-next');
        setLayout(1000, 500);
        await flushReaderRender();
        const secondBody = getReaderBody(panel);
        expect(secondBody.scrollTop).toBe(0);
        secondBody.scrollTop = 250;
        secondBody.dispatchEvent(new Event('scroll'));

        setLayout(1000, 500);
        clickReaderAction('reader-prev');
        setLayout(2000, 500);
        await flushReaderRender();
        expect(getReaderBody(panel).scrollTop).toBe(750);

        setLayout(2000, 500);
        clickReaderAction('reader-next');
        setLayout(1000, 500);
        await flushReaderRender();
        expect(getReaderBody(panel).scrollTop).toBe(250);

        closePanel(panel);
    });

    it('keeps the current item position through content replacement and close/reopen', async () => {
        const panel = new ReaderPanel();
        await panel.show([readerItems()[0]!], 0, 'light', { profile: 'conversation-reader' });

        getReaderBody(panel).scrollTop = 900;
        getReaderBody(panel).dispatchEvent(new Event('scroll'));

        await panel.replaceItems([
            { id: 'assistant-a', userPrompt: 'Question A updated', content: 'Content A updated' },
        ], { preserveCurrentIdentity: true });
        expect(getReaderBody(panel).scrollTop).toBe(900);

        closePanel(panel);
        await panel.show([
            { id: 'assistant-a', userPrompt: 'Question A updated', content: 'Content A updated' },
        ], 0, 'light', { profile: 'conversation-reader' });
        expect(getReaderBody(panel).scrollTop).toBe(900);

        closePanel(panel);
    });

    it('retries one frame when the restored body has not received layout yet', async () => {
        const panel = new ReaderPanel();
        const item = readerItems()[0]!;
        await panel.show([item], 0, 'light', { profile: 'conversation-reader' });
        getReaderBody(panel).scrollTop = 750;
        getReaderBody(panel).dispatchEvent(new Event('scroll'));
        closePanel(panel);

        setLayout(0, 500);
        await panel.show([item], 0, 'light', { profile: 'conversation-reader' });
        expect(getReaderBody(panel).scrollTop).toBe(0);

        setLayout(2000, 500);
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(getReaderBody(panel).scrollTop).toBe(750);

        closePanel(panel);
    });

    it('does not carry position into a new ReaderPanel instance', async () => {
        const item = readerItems()[0]!;
        const firstPanel = new ReaderPanel();
        await firstPanel.show([item], 0, 'light', { profile: 'conversation-reader' });
        getReaderBody(firstPanel).scrollTop = 750;
        getReaderBody(firstPanel).dispatchEvent(new Event('scroll'));
        closePanel(firstPanel);

        const freshPanel = new ReaderPanel();
        await freshPanel.show([item], 0, 'light', { profile: 'conversation-reader' });
        expect(getReaderBody(freshPanel).scrollTop).toBe(0);
        closePanel(freshPanel);
    });

    it('isolates positions between Reader profiles while keeping each profile in memory', async () => {
        const panel = new ReaderPanel();
        const item = { id: 'shared-item', userPrompt: 'Shared question', content: 'Shared content' };

        await panel.show([item], 0, 'light', { profile: 'conversation-reader' });
        getReaderBody(panel).scrollTop = 600;
        getReaderBody(panel).dispatchEvent(new Event('scroll'));

        await panel.show([item], 0, 'light', { profile: 'bookmark-preview' });
        expect(getReaderBody(panel).scrollTop).toBe(0);
        getReaderBody(panel).scrollTop = 300;
        getReaderBody(panel).dispatchEvent(new Event('scroll'));

        await panel.show([item], 0, 'light', { profile: 'conversation-reader' });
        expect(getReaderBody(panel).scrollTop).toBe(600);

        await panel.show([item], 0, 'light', { profile: 'bookmark-preview' });
        expect(getReaderBody(panel).scrollTop).toBe(300);

        closePanel(panel);
    });
});
