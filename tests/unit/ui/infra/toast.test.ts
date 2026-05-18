import { describe, expect, it, vi } from 'vitest';
import { showToast } from '@/utils/toast';

describe('showToast', () => {
    it('renders a single top-level status toast and removes it after the default duration', async () => {
        vi.useFakeTimers();

        showToast({ text: 'Copied' });

        const viewport = document.getElementById('aimd-toast-viewport');
        const toast = viewport?.querySelector<HTMLElement>('.aimd-toast');
        expect(viewport).toBeTruthy();
        expect(toast?.textContent).toBe('Copied');
        expect(toast?.getAttribute('role')).toBe('status');
        expect(toast?.getAttribute('aria-live')).toBe('polite');

        vi.advanceTimersByTime(3000);
        await Promise.resolve();
        expect(document.querySelector('.aimd-toast')).toBeNull();

        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('replaces the previous toast when a new feedback message appears', () => {
        vi.useFakeTimers();

        showToast({ text: 'Rendering...' });
        showToast({ text: 'Copied', tone: 'success' });

        const toasts = document.querySelectorAll<HTMLElement>('.aimd-toast');
        expect(toasts).toHaveLength(1);
        expect(toasts[0]?.textContent).toBe('Copied');
        expect(toasts[0]?.dataset.tone).toBe('success');

        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('uses shared toast tokens instead of component-local colors', () => {
        showToast({ text: 'Saved' });

        const style = document.getElementById('aimd-shared-toast-style');
        const css = style?.textContent ?? '';
        expect(css).toContain('background: var(--aimd-toast-bg');
        expect(css).toContain('color: var(--aimd-toast-text');
        expect(css).toContain('box-shadow: var(--aimd-toast-shadow');
        expect(css).toContain('z-index: var(--aimd-toast-z');

        document.body.innerHTML = '';
    });
});
