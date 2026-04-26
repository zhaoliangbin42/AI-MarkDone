import { beforeEach, describe, expect, it, vi } from 'vitest';

const browserCapabilitiesMock = vi.hoisted(() => ({
    canInject: true,
}));

vi.mock('@/drivers/shared/browserApi/pageHeaderIcon', () => ({
    pageHeaderIconCapability: browserCapabilitiesMock,
}));

import { HeaderIconOrchestrator } from '@/ui/content/controllers/HeaderIconOrchestrator';

describe('HeaderIconOrchestrator', () => {
    beforeEach(() => {
        browserCapabilitiesMock.canInject = true;
        document.body.innerHTML = '';
        document.querySelector('#aimd-header-icon-style')?.remove();
    });

    it('creates a shared header icon button with common hover styles', () => {
        const injectHeaderIcon = vi.fn((host: HTMLElement) => {
            document.body.appendChild(host);
            return true;
        });

        const orchestrator = new HeaderIconOrchestrator(
            {
                injectHeaderIcon,
            } as any,
            { onToggle: vi.fn() }
        );

        orchestrator.init();

        const button = document.querySelector('#aimd-header-icon-btn');
        const style = document.querySelector('#aimd-header-icon-style');

        expect(button).toBeInstanceOf(HTMLDivElement);
        expect(button?.getAttribute('data-aimd-role')).toBe('header-icon');
        expect(button?.getAttribute('role')).toBe('button');
        expect(button?.getAttribute('tabindex')).toBe('0');
        expect(button?.getAttribute('title')).toBeTruthy();
        expect(style).toBeInstanceOf(HTMLStyleElement);
        expect(style?.textContent).toContain('[data-aimd-role="header-icon"]:focus-visible');
        expect(style?.textContent).not.toContain('[data-aimd-role="header-icon"]:hover');
        expect(injectHeaderIcon).toHaveBeenCalledTimes(1);

        orchestrator.dispose();
    });

    it('invokes the toggle handler when the injected header icon is clicked', () => {
        const onToggle = vi.fn();
        const injectHeaderIcon = vi.fn((host: HTMLElement) => {
            document.body.appendChild(host);
            return true;
        });

        const orchestrator = new HeaderIconOrchestrator(
            {
                injectHeaderIcon,
            } as any,
            { onToggle }
        );

        orchestrator.init();

        const button = document.querySelector<HTMLElement>('#aimd-header-icon-btn');
        expect(button).toBeTruthy();

        button?.click();

        expect(onToggle).toHaveBeenCalledTimes(1);

        orchestrator.dispose();
    });

    it('skips page header icon injection when the browser capability disables it', () => {
        browserCapabilitiesMock.canInject = false;
        const injectHeaderIcon = vi.fn((host: HTMLElement) => {
            document.body.appendChild(host);
            return true;
        });

        const orchestrator = new HeaderIconOrchestrator(
            {
                injectHeaderIcon,
            } as any,
            { onToggle: vi.fn() }
        );

        orchestrator.init();

        expect(injectHeaderIcon).not.toHaveBeenCalled();
        expect(document.querySelector('#aimd-header-icon-btn')).toBeNull();
        expect(document.querySelector('#aimd-header-icon-style')).toBeNull();
    });
});
