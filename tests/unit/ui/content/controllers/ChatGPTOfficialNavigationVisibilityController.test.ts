import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTOfficialNavigationVisibilityController } from '@/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController';

function setRect(element: HTMLElement, rect: Partial<DOMRect>): void {
    element.getBoundingClientRect = () => ({
        x: rect.x ?? 0,
        y: rect.y ?? 0,
        width: rect.width ?? 0,
        height: rect.height ?? 0,
        top: rect.y ?? 0,
        left: rect.x ?? 0,
        right: (rect.x ?? 0) + (rect.width ?? 0),
        bottom: (rect.y ?? 0) + (rect.height ?? 0),
        toJSON: () => ({}),
    } as DOMRect);
}

describe('ChatGPTOfficialNavigationVisibilityController', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 950 });
    });

    afterEach(() => {
        vi.useRealTimers();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('hides the fixed right child under the official conversation highlight root', () => {
        document.body.innerHTML = `
            <main id="thread">
                <div class="abc123_convSearchResultHighlightRoot">
                    <div class="fixed right-rail" style="position: fixed;">
                        <span></span>
                    </div>
                    <section data-testid="conversation-turn-1" data-turn="user"></section>
                </div>
            </main>
        `;
        const rail = document.querySelector<HTMLElement>('.right-rail')!;
        setRect(rail, { x: 1338, y: 389, width: 36, height: 170 });
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        expect(rail.hidden).toBe(true);
        expect(rail.getAttribute('data-aimd-official-conversation-nav-hidden')).toBe('1');
        const styleText = document.getElementById('aimd-official-conversation-nav-visibility-style')?.textContent;
        expect(styleText).toContain('data-aimd-official-conversation-nav-hidden');
        expect(styleText).toContain('_convSearchResultHighlightRoot');

        controller.setEnabled(false);

        expect(rail.hidden).toBe(false);
        expect(rail.hasAttribute('data-aimd-official-conversation-nav-hidden')).toBe(false);
        expect(document.getElementById('aimd-official-conversation-nav-visibility-style')).toBeNull();
    });

    it('hides a delayed fixed right child appended after the controller is enabled', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<main id="thread"><div class="abc123_convSearchResultHighlightRoot"></div></main>';
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        const root = document.querySelector<HTMLElement>('.abc123_convSearchResultHighlightRoot')!;
        const rail = document.createElement('div');
        rail.className = 'fixed inset-e-4 top-1/2 z-20 -translate-y-1/2';
        rail.style.position = 'fixed';
        setRect(rail, { x: 1338, y: 389, width: 36, height: 170 });
        root.prepend(rail);
        await Promise.resolve();
        vi.advanceTimersByTime(250);

        expect(rail.hidden).toBe(true);
        expect(rail.getAttribute('data-aimd-official-conversation-nav-hidden')).toBe('1');
    });

    it('hides a fixed child when ChatGPT applies the official class tokens after insertion', async () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <main id="thread">
                <div class="abc123_convSearchResultHighlightRoot">
                    <div class="right-rail" style="position: fixed;"></div>
                </div>
            </main>
        `;
        const rail = document.querySelector<HTMLElement>('.right-rail')!;
        setRect(rail, { x: 1180, y: 389, width: 200, height: 170 });
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);
        expect(rail.hidden).toBe(false);

        rail.className = 'fixed inset-e-4 top-1/2 z-20 -translate-y-1/2';
        await Promise.resolve();
        vi.advanceTimersByTime(250);

        expect(rail.hidden).toBe(true);
        expect(rail.getAttribute('data-aimd-official-conversation-nav-hidden')).toBe('1');
    });

    it('does not hide the official conversation root when it has no fixed right child', () => {
        document.body.innerHTML = `
            <main id="thread">
                <div class="abc123_convSearchResultHighlightRoot">
                    <section data-testid="conversation-turn-1" data-turn="user"></section>
                </div>
            </main>
        `;
        const root = document.querySelector<HTMLElement>('.abc123_convSearchResultHighlightRoot')!;
        setRect(root, { x: 272, y: 0, width: 1100, height: 900 });
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        expect(root.hidden).toBe(false);
        expect(root.hasAttribute('data-aimd-official-conversation-nav-hidden')).toBe(false);
    });

    it('does not hide ChatGPT left history sidebar navigation', () => {
        document.body.innerHTML = `
            <aside id="stage-slideover-sidebar">
                <div class="abc123_convSearchResultHighlightRoot">
                    <div class="fixed right-rail" style="position: fixed;"></div>
                </div>
            </aside>
            <main id="thread"></main>
        `;
        const rail = document.querySelector<HTMLElement>('.right-rail')!;
        setRect(rail, { x: 12, y: 389, width: 36, height: 170 });
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        expect(rail.hidden).toBe(false);
        expect(rail.hasAttribute('data-aimd-official-conversation-nav-hidden')).toBe(false);
    });

    it('does not hide AI-MarkDone-owned fixed chrome', () => {
        document.body.innerHTML = `
            <main id="thread">
                <div class="abc123_convSearchResultHighlightRoot">
                    <div class="fixed right-rail" data-aimd-role="message-toolbar" style="position: fixed;"></div>
                </div>
            </main>
        `;
        const rail = document.querySelector<HTMLElement>('.right-rail')!;
        setRect(rail, { x: 1338, y: 389, width: 36, height: 170 });
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        expect(rail.hidden).toBe(false);
        expect(rail.hasAttribute('data-aimd-official-conversation-nav-hidden')).toBe(false);
    });

    it('leaves ordinary page navigation alone', () => {
        document.body.innerHTML = `
            <main id="thread">
                <nav aria-label="Primary">Home Settings</nav>
            </main>
        `;
        const nav = document.querySelector<HTMLElement>('nav')!;
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        expect(nav.hidden).toBe(false);
        expect(nav.hasAttribute('data-aimd-official-conversation-nav-hidden')).toBe(false);
    });
});
