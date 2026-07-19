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

describe('ReaderPanel navigation', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('keeps the first pager dot active for large conversations', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        const items = Array.from({ length: 750 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            const counter = shadow.querySelector<HTMLElement>('.reader-header-page');
            expect(counter?.textContent).toBe('1/750');

            const active = shadow.querySelector<HTMLButtonElement>('.reader-dots .reader-dot--active');
            expect(active?.dataset.tooltipTitle).toBe('1');
        } finally {
            panel.hide();
        }
    });

    it('marks the active bottom pager dot for the current page', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                    { id: 'c', userPrompt: 'Q3', content: 'md3' },
                ],
                2,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            const counter = shadow.querySelector<HTMLElement>('.reader-header-page');
            expect(counter?.textContent).toBe('3/3');

            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));
            const active = dots.find((dot) => dot.classList.contains('reader-dot--active'));

            expect(dots).toHaveLength(3);
            expect(active?.dataset.tooltipTitle).toBe('3');
        } finally {
            panel.hide();
        }
    });

    it('renders bookmarked pages as square dots and keeps the active bookmarked page highlighted', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1', meta: { position: 1, bookmarked: false } },
                    { id: 'b', userPrompt: 'Q2', content: 'md2', meta: { position: 2, bookmarked: true } },
                    { id: 'c', userPrompt: 'Q3', content: 'md3', meta: { position: 3, bookmarked: true } },
                ],
                1,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));

            expect(dots[0]?.classList.contains('reader-dot--bookmarked')).toBe(false);
            expect(dots[1]?.classList.contains('reader-dot--bookmarked')).toBe(true);
            expect(dots[1]?.classList.contains('reader-dot--active')).toBe(true);
            expect(dots[2]?.classList.contains('reader-dot--bookmarked')).toBe(true);
        } finally {
            panel.hide();
        }
    });

    it('uses the bookmark-preview profile to force plain round pager dots even when items carry bookmark metadata', async () => {
        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1', meta: { position: 1, bookmarked: true } },
                    { id: 'b', userPrompt: 'Q2', content: 'md2', meta: { position: 2, bookmarked: true } },
                ],
                0,
                'light',
                { profile: 'bookmark-preview' }
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));

            expect(dots[0]?.classList.contains('reader-dot--bookmarked')).toBe(false);
            expect(dots[1]?.classList.contains('reader-dot--bookmarked')).toBe(false);
        } finally {
            panel.hide();
        }
    });

    it('supports ArrowLeft and ArrowRight to change pages', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                    { id: 'c', userPrompt: 'Q3', content: 'md3' },
                ],
                1,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('2/3');

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            await Promise.resolve();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('3/3');

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
            await Promise.resolve();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('2/3');
        } finally {
            panel.hide();
        }
    });

    it('supports ArrowUp and ArrowDown to scroll the current reader body', async () => {
        setClipboardMock();

        const panel = new ReaderPanel();
        try {
            await panel.show(
                [{ id: 'a', userPrompt: 'Q1', content: Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join('\n\n') }],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const body = shadow.querySelector<HTMLElement>('.reader-body');
            expect(body).toBeTruthy();
            if (!body) return;

            const scrollBy = vi.fn();
            Object.defineProperty(body, 'clientHeight', { value: 1000, configurable: true });
            Object.defineProperty(body, 'scrollHeight', { value: 2400, configurable: true });
            Object.defineProperty(body, 'scrollBy', { value: scrollBy, configurable: true });

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
            expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
            expect(scrollBy.mock.calls[0]?.[0]?.top).toBeGreaterThan(0);

            host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
            expect(scrollBy.mock.calls[1]?.[0]?.top).toBeLessThan(0);
        } finally {
            panel.hide();
        }
    });

    it('shows the current page in the footer and scrolls the active pager dot into view for long conversations', async () => {
        setClipboardMock();
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            value: scrollIntoView,
            configurable: true,
        });

        const panel = new ReaderPanel();
        const items = Array.from({ length: 50 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 30, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const footerPage = shadow.querySelector<HTMLElement>('.reader-footer__meta .reader-footer-page');
            const dots = shadow.querySelector<HTMLElement>('.reader-dots');
            const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
            const dotsRule = styleText.match(/\.reader-dots\s*\{[\s\S]*?\}/)?.[0] ?? '';

            expect(footerPage?.textContent).toBe('31/50');
            expect(dots).toBeTruthy();
            expect(dotsRule).toContain('.reader-dots {');
            expect(dotsRule).toContain('flex-wrap: nowrap;');
            expect(dotsRule).toContain('overflow-y: hidden;');
            expect(dotsRule).toContain('overflow-x: auto;');
            expect(dotsRule).toContain('white-space: nowrap;');
            expect(scrollIntoView).toHaveBeenCalled();
        } finally {
            panel.hide();
        }
    });

    it('keeps one fixed pager dot size and gap even for very long conversations', async () => {
        const panel = new ReaderPanel();
        const items = Array.from({ length: 120 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 60, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = shadow.querySelector<HTMLElement>('.reader-dots');

            expect(dots?.style.getPropertyValue('--_reader-dot-size')).toBe('10px');
            expect(dots?.style.getPropertyValue('--_reader-dot-gap')).toBe('10px');
        } finally {
            panel.hide();
        }
    });

    it('renders long-range pager gaps as a dedicated three-dot ellipsis unit instead of plain text', async () => {
        const panel = new ReaderPanel();
        const items = Array.from({ length: 80 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 40, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const ellipsis = shadow.querySelector<HTMLElement>('.reader-dots .reader-ellipsis');
            const dots = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-dots .reader-ellipsis__dot'));

            expect(ellipsis).toBeTruthy();
            expect(ellipsis?.textContent).not.toContain('…');
            expect(dots).toHaveLength(6);
        } finally {
            panel.hide();
        }
    });

    it('limits middle reader pagination to first three, middle four, and last three page dots', async () => {
        const panel = new ReaderPanel();
        const items = Array.from({ length: 80 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 40, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));
            const titles = dots.map((dot) => dot.dataset.tooltipTitle);
            const ellipses = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-dots .reader-ellipsis'));

            expect(dots).toHaveLength(10);
            expect(titles).toEqual(['1', '2', '3', '40', '41', '42', '43', '78', '79', '80']);
            expect(ellipses).toHaveLength(2);
            expect(dots.find((dot) => dot.classList.contains('reader-dot--active'))?.dataset.tooltipTitle).toBe('41');
        } finally {
            panel.hide();
        }
    });

    it('keeps a compact current-page window near the start instead of expanding to seven leading page dots', async () => {
        const panel = new ReaderPanel();
        const items = Array.from({ length: 80 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));
            const titles = dots.map((dot) => dot.dataset.tooltipTitle);

            expect(titles).toEqual(['1', '2', '3', '4', '78', '79', '80']);
            expect(titles).not.toContain('7');
            expect(dots.find((dot) => dot.classList.contains('reader-dot--active'))?.dataset.tooltipTitle).toBe('1');
        } finally {
            panel.hide();
        }
    });

    it('keeps a compact current-page window near the end instead of expanding to seven trailing page dots', async () => {
        const panel = new ReaderPanel();
        const items = Array.from({ length: 80 }, (_, index) => ({
            id: `item-${index}`,
            userPrompt: `Q${index + 1}`,
            content: `md${index + 1}`,
        }));

        try {
            await panel.show(items, 79, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));
            const titles = dots.map((dot) => dot.dataset.tooltipTitle);

            expect(titles).toEqual(['1', '2', '3', '77', '78', '79', '80']);
            expect(titles).not.toContain('74');
            expect(dots.find((dot) => dot.classList.contains('reader-dot--active'))?.dataset.tooltipTitle).toBe('80');
        } finally {
            panel.hide();
        }
    });

    it('appends a new tail page without changing the current page selection', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();

        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: 'md1' },
                    { id: 'b', userPrompt: 'Q2', content: 'md2' },
                ],
                1,
                'light'
            );

            await panel.appendItem({ id: 'c', userPrompt: 'Q3', content: 'md3' });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const counter = shadow.querySelector<HTMLElement>('.reader-header-page');
            const dots = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot'));

            expect(counter?.textContent).toBe('2/3');
            expect(dots).toHaveLength(3);
            expect(dots[1]?.classList.contains('reader-dot--active')).toBe(true);

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy"]')?.click();
            await Promise.resolve();
            await Promise.resolve();
            expect(writeText).toHaveBeenCalledWith('md2');
        } finally {
            panel.hide();
        }
    });

    it('replaces a visible conversation branch while preserving the current stable user identity', async () => {
        const { writeText } = setClipboardMock();
        const panel = new ReaderPanel();

        try {
            await panel.show([
                { id: 'a1', userPrompt: 'Q1', content: 'old-1', meta: { position: 1, userMessageId: 'u1', assistantMessageId: 'a1' } },
                { id: 'a2', userPrompt: 'Q2', content: 'old-2', meta: { position: 2, userMessageId: 'u2', assistantMessageId: 'a2' } },
                { id: 'a3', userPrompt: 'Q3', content: 'old-3', meta: { position: 3, userMessageId: 'u3', assistantMessageId: 'a3' } },
            ], 1, 'light', { profile: 'conversation-reader' });

            await panel.replaceItems([
                { id: 'b2', userPrompt: 'Q2 regenerated', content: 'new-2', meta: { position: 1, userMessageId: 'u2', assistantMessageId: 'b2' } },
                { id: 'b4', userPrompt: 'Q4', content: 'new-4', meta: { position: 2, userMessageId: 'u4', assistantMessageId: 'b4' } },
            ], { preserveCurrentIdentity: true });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('1/2');
            expect(panel.getItemsSnapshot().map((item) => item.id)).toEqual(['b2', 'b4']);

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy"]')?.click();
            await Promise.resolve();
            await Promise.resolve();
            expect(writeText).toHaveBeenCalledWith('new-2');
        } finally {
            panel.hide();
        }
    });

    it('does not replace bookmark preview items through the conversation branch Interface', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([
                { id: 'bookmark-a', userPrompt: 'Saved prompt', content: 'saved content' },
            ], 0, 'light', { profile: 'bookmark-preview' });

            await panel.replaceItems([
                { id: 'conversation-b', userPrompt: 'Conversation prompt', content: 'conversation content' },
            ], { preserveCurrentIdentity: true });

            expect(panel.getItemsSnapshot().map((item) => item.id)).toEqual(['bookmark-a']);
        } finally {
            panel.hide();
        }
    });

    it('renders a heading outline rail for markdown pages with multiple headings', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show(
                [{
                    id: 'a',
                    userPrompt: 'Q1',
                    content: ['# Overview', '', '## Details', '', '### Next steps'].join('\n'),
                }],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const rail = shadow.querySelector<HTMLElement>('.reader-outline-rail');
            const buttons = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-outline-rail__item'));

            expect(rail).toBeTruthy();
            expect(rail?.getAttribute('aria-label')).toBeTruthy();
            expect(buttons.map((button) => button.querySelector('.reader-outline-rail__index')?.textContent)).toEqual(['H1', 'H2', 'H3']);
            expect(buttons.map((button) => button.querySelector('.reader-outline-rail__label')?.textContent)).toEqual(['Overview', 'Details', 'Next steps']);
            expect(buttons.map((button) => button.dataset.level)).toEqual(['1', '2', '3']);
        } finally {
            panel.hide();
        }
    });

    it('does not render the heading outline rail for pages without at least two headings', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: '# Only heading\n\nBody' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            expect(shadow.querySelector('.reader-outline-rail')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('can hide the heading outline rail through reader settings without changing markdown rendering', async () => {
        const panel = new ReaderPanel();
        panel.setShowOutlineInReader(false);

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: '# First\n\n## Second\n\nBody' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            expect(shadow.querySelector('.reader-outline-rail')).toBeNull();
            expect(shadow.querySelector('.reader-markdown h1')?.textContent).toBe('First');
            expect(shadow.querySelector('.reader-body-wrap')?.getAttribute('data-has-outline')).toBe('0');
        } finally {
            panel.hide();
        }
    });

    it('jumps to a heading outline target without changing the current reader page', async () => {
        const scrollTo = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
            value: scrollTo,
            configurable: true,
        });

        const panel = new ReaderPanel();

        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: '# First\n\n## Second\n\nBody' },
                    { id: 'b', userPrompt: 'Q2', content: '# Other\n\n## Tail' },
                ],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const buttons = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-outline-rail__item'));
            buttons[1]?.click();
            await Promise.resolve();

            expect(scrollTo).toHaveBeenCalled();
            expect(shadow.querySelector<HTMLElement>('.reader-header-page')?.textContent).toBe('1/2');
            expect(buttons[1]?.dataset.active).toBe('1');
        } finally {
            panel.hide();
        }
    });

    it('refreshes the heading outline when changing reader pages', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'Q1', content: '# First\n\n## Second' },
                    { id: 'b', userPrompt: 'Q2', content: '# Later\n\n## Appendix' },
                ],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            expect(Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-outline-rail__item')).map((button) => button.querySelector('.reader-outline-rail__label')?.textContent)).toEqual(['First', 'Second']);

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')?.click();
            await Promise.resolve();
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-outline-rail__item')).map((button) => button.querySelector('.reader-outline-rail__label')?.textContent)).toEqual(['Later', 'Appendix']);
        } finally {
            panel.hide();
        }
    });

    it('updates the active heading outline item from reader body scrolling', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Q1', content: '# First\n\n## Second\n\n### Third' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const body = shadow.querySelector<HTMLElement>('.reader-body')!;
            const headings = Array.from(shadow.querySelectorAll<HTMLElement>('.reader-markdown h1, .reader-markdown h2, .reader-markdown h3'));
            Object.defineProperty(body, 'getBoundingClientRect', {
                value: () => ({ top: 0, bottom: 500, left: 0, right: 500, width: 500, height: 500, x: 0, y: 0, toJSON: () => ({}) }),
                configurable: true,
            });
            headings.forEach((heading, index) => {
                Object.defineProperty(heading, 'getBoundingClientRect', {
                    value: () => ({ top: index === 1 ? 12 : index * 200, bottom: 40, left: 0, right: 300, width: 300, height: 40, x: 0, y: 0, toJSON: () => ({}) }),
                    configurable: true,
                });
            });

            body.dispatchEvent(new Event('scroll'));
            await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

            const buttons = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.reader-outline-rail__item'));
            expect(buttons[1]?.dataset.active).toBe('1');
        } finally {
            panel.hide();
        }
    });
});
