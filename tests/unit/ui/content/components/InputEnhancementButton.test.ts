import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputEnhancementButton } from '@/ui/content/components/InputEnhancementButton';

describe('InputEnhancementButton', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('opens its dialog without toggling the enabled state directly', () => {
        const onOpen = vi.fn();
        const control = new InputEnhancementButton({ onOpen });
        const button = control.host.shadowRoot?.querySelector<HTMLButtonElement>('button')!;

        expect(control.host.dataset.aimdRole).toBe('input-enhancement-button');
        expect(button.getAttribute('aria-haspopup')).toBe('dialog');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(button.hasAttribute('aria-pressed')).toBe(false);

        button.click();
        expect(onOpen).toHaveBeenCalledOnce();

        control.setExpanded(true);
        control.setEnabled(true);
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(button.dataset.active).toBe('1');
        control.dispose();
    });
});
