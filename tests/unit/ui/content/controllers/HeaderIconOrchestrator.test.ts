import { describe, expect, it, vi } from 'vitest';
import { HeaderIconOrchestrator } from '@/ui/content/controllers/HeaderIconOrchestrator';

describe('HeaderIconOrchestrator', () => {
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
        expect(style).toBeInstanceOf(HTMLStyleElement);
        expect(style?.textContent).toContain('[data-aimd-role="header-icon"]:focus-visible');
        expect(style?.textContent).not.toContain('[data-aimd-role="header-icon"]:hover');
        expect(injectHeaderIcon).toHaveBeenCalledTimes(1);

        orchestrator.dispose();
    });
});
