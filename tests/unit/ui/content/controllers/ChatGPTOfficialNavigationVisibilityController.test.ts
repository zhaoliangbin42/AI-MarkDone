import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTOfficialNavigationVisibilityController } from '@/ui/content/controllers/ChatGPTOfficialNavigationVisibilityController';

const ROOT_AT_END = 'main [class$="_convSearchResultHighlightRoot"]';
const ROOT_BEFORE_SPACE = 'main [class*="_convSearchResultHighlightRoot "]';
const FIXED_CHILD = '> [class~="fixed"][class~="inset-e-4"][class~="top-1/2"][class~="z-20"][class~="-translate-y-1/2"]:not([data-aimd-role])';
const OFFICIAL_NAV_SELECTOR = `${ROOT_AT_END} ${FIXED_CHILD}, ${ROOT_BEFORE_SPACE} ${FIXED_CHILD}`;

class FakeMutationObserver {
    static instances: FakeMutationObserver[] = [];
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(_callback: MutationCallback) {
        FakeMutationObserver.instances.push(this);
    }
}

describe('ChatGPTOfficialNavigationVisibilityController', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        FakeMutationObserver.instances = [];
        vi.stubGlobal('MutationObserver', FakeMutationObserver);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('uses one exact fail-open CSS rule without mutating ChatGPT navigation nodes', () => {
        document.body.innerHTML = `
            <main>
                <div class="abc123_convSearchResultHighlightRoot">
                    <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2 right-rail"></div>
                </div>
            </main>
        `;
        const rail = document.querySelector<HTMLElement>('.right-rail')!;
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        const style = document.getElementById('aimd-official-conversation-nav-visibility-style');
        expect(style?.textContent).toContain(`${ROOT_AT_END} ${FIXED_CHILD}`);
        expect(style?.textContent).toContain(`${ROOT_BEFORE_SPACE} ${FIXED_CHILD}`);
        expect(style?.textContent).not.toContain('[data-aimd-official-conversation-nav-hidden]');
        expect(document.querySelectorAll(OFFICIAL_NAV_SELECTOR)).toHaveLength(1);
        expect(rail.hidden).toBe(false);
        expect(rail.hasAttribute('data-aimd-official-conversation-nav-hidden')).toBe(false);
        expect(FakeMutationObserver.instances).toHaveLength(0);
    });

    it('lets CSS cover a delayed official rail without timers or observers', () => {
        document.body.innerHTML = '<main><div class="abc123_convSearchResultHighlightRoot root-extra"></div></main>';
        const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
        const controller = new ChatGPTOfficialNavigationVisibilityController();
        controller.setEnabled(true);

        const root = document.querySelector<HTMLElement>('.root-extra')!;
        const rail = document.createElement('div');
        rail.className = 'fixed inset-e-4 top-1/2 z-20 -translate-y-1/2';
        root.appendChild(rail);

        expect(Array.from(document.querySelectorAll(OFFICIAL_NAV_SELECTOR))).toEqual(expect.arrayContaining([rail]));
        expect(FakeMutationObserver.instances).toHaveLength(0);
        expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it('fails open for near-match roots, ordinary navigation, and extension-owned chrome', () => {
        document.body.innerHTML = `
            <aside>
                <div class="abc123_convSearchResultHighlightRoot">
                    <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2 outside-main"></div>
                </div>
            </aside>
            <main>
                <div class="abc123_convSearchResultHighlightRootExtra">
                    <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2 near-match"></div>
                </div>
                <div class="abc123_convSearchResultHighlightRoot">
                    <div data-aimd-role="message-toolbar" class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2 extension-owned"></div>
                </div>
                <nav aria-label="Primary">Home Settings</nav>
            </main>
        `;
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);

        expect(document.querySelectorAll(OFFICIAL_NAV_SELECTOR)).toHaveLength(0);
        expect(document.querySelector<HTMLElement>('.outside-main')?.hidden).toBe(false);
        expect(document.querySelector<HTMLElement>('.near-match')?.hidden).toBe(false);
        expect(document.querySelector<HTMLElement>('.extension-owned')?.hidden).toBe(false);
        expect(document.querySelector<HTMLElement>('nav')?.hidden).toBe(false);
    });

    it('removes the rule when disabled or disposed and never duplicates it', () => {
        const controller = new ChatGPTOfficialNavigationVisibilityController();

        controller.setEnabled(true);
        controller.setEnabled(true);
        expect(document.querySelectorAll('#aimd-official-conversation-nav-visibility-style')).toHaveLength(1);

        controller.setEnabled(false);
        expect(document.getElementById('aimd-official-conversation-nav-visibility-style')).toBeNull();

        controller.setEnabled(true);
        controller.dispose();
        expect(document.getElementById('aimd-official-conversation-nav-visibility-style')).toBeNull();
        expect(FakeMutationObserver.instances).toHaveLength(0);
    });
});
