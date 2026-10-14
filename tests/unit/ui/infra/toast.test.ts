import { afterEach, describe, expect, it, vi } from 'vitest';
import { showToast } from '@/utils/toast';

describe('showToast', () => {
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.replaceChildren();
        document.getElementById('aimd-shared-toast-style')?.remove();
    });

    it('renders a single top-level status toast and removes it after the default duration', async () => {
        vi.useFakeTimers();

        showToast({ text: 'Copied' });

        const viewport = document.getElementById('aimd-toast-viewport');
        const toast = viewport?.querySelector<HTMLElement>('.aimd-toast');
        expect(viewport).toBeTruthy();
        expect(toast?.textContent).toBe('Copied');
        expect(toast?.getAttribute('role')).toBe('status');
        expect(toast?.getAttribute('aria-live')).toBe('polite');
        expect(viewport?.hasAttribute('data-aimd-transient-root')).toBe(false);

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

    it('keeps an explicit duration for a toast without an action', () => {
        vi.useFakeTimers();
        showToast({ text: 'Copied', durationMs: 1200 });

        vi.advanceTimersByTime(1199);
        expect(document.querySelector('.aimd-toast')?.textContent).toBe('Copied');
        vi.advanceTimersByTime(1);
        expect(document.getElementById('aimd-toast-viewport')).toBeNull();
    });

    it('keeps a safe link actionable until the user activates it', () => {
        vi.useFakeTimers();
        const open = vi.spyOn(window, 'open');
        const trigger = document.createElement('button');
        trigger.textContent = 'Go to message';
        trigger.addEventListener('click', () => showToast({
            text: 'Could not locate this message.',
            durationMs: 100,
            action: {
                label: 'Open message in new tab',
                href: 'https://chatgpt.com/c/conversation?message=assistant-id',
            },
        }));
        document.body.appendChild(trigger);
        trigger.focus();
        trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        trigger.click();

        const link = document.querySelector<HTMLAnchorElement>('.aimd-toast a');
        expect(link?.textContent).toBe('Open message in new tab');
        expect(link?.href).toBe('https://chatgpt.com/c/conversation?message=assistant-id');
        expect(link?.target).toBe('_blank');
        expect(link?.rel).toBe('noopener noreferrer');
        expect(link?.closest('[data-aimd-transient-root]')).toBeTruthy();
        expect(document.activeElement).toBe(trigger);
        expect(open).not.toHaveBeenCalled();

        vi.advanceTimersByTime(60_000);
        expect(link?.isConnected).toBe(true);
        link?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        link?.focus();
        expect(link?.isConnected).toBe(true);
        link?.click();
        expect(document.getElementById('aimd-toast-viewport')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('offers an explicit localized close button and returns focus to the trigger', () => {
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();
        showToast({
            text: 'Could not locate this message.',
            action: { label: 'Open message in new tab', href: 'https://chatgpt.com/c/conversation?message=a' },
            closeLabel: '关闭',
        });

        const close = document.querySelector<HTMLButtonElement>('.aimd-toast button');
        expect(close?.type).toBe('button');
        expect(close?.getAttribute('aria-label')).toBe('关闭');
        close?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        close?.focus();
        expect(document.querySelector('.aimd-toast')).not.toBeNull();
        close?.click();
        expect(document.getElementById('aimd-toast-viewport')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('replaces persistent feedback and clears the previous toast timer', () => {
        vi.useFakeTimers();
        showToast({ text: 'Copied', durationMs: 100 });
        showToast({
            text: 'Could not locate this message.',
            action: { label: 'Open message in new tab', href: 'https://chatgpt.com/c/conversation?message=a' },
        });
        vi.advanceTimersByTime(3000);
        expect(document.querySelector('.aimd-toast a')).not.toBeNull();

        showToast({ text: 'Saved', tone: 'success' });
        expect(document.querySelectorAll('.aimd-toast')).toHaveLength(1);
        expect(document.querySelector('.aimd-toast')?.textContent).toBe('Saved');
        expect(document.querySelector('.aimd-toast a')).toBeNull();
        vi.advanceTimersByTime(3000);
        expect(document.getElementById('aimd-toast-viewport')).toBeNull();
    });

    it('returns focus inside a ShadowRoot when focused feedback is replaced', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const trigger = document.createElement('button');
        shadow.appendChild(trigger);
        document.body.appendChild(host);
        trigger.focus();
        showToast({ text: 'Could not locate this message.', action: { label: 'Open', href: 'https://chatgpt.com/c/a' } });
        document.querySelector<HTMLAnchorElement>('.aimd-toast a')?.focus();

        showToast({ text: 'Saved' });

        expect(shadow.activeElement).toBe(trigger);
        expect(document.querySelector('.aimd-toast')?.textContent).toBe('Saved');
    });

    it.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'http://chatgpt.com/c/conversation',
        '//chatgpt.com/c/conversation',
        '/c/conversation',
        'https://user:password@chatgpt.com/c/conversation',
        'https://chatgpt.com\n/c/conversation',
        'https://chatgpt.com/c/conversation\n',
        'https://',
        'not a URL',
    ])('rejects an unsafe or invalid action URL: %s', (href) => {
        vi.useFakeTimers();
        showToast({ text: 'Could not locate this message.', action: { label: 'Open', href } });

        expect(document.querySelector('.aimd-toast a')).toBeNull();
        vi.advanceTimersByTime(3000);
        expect(document.getElementById('aimd-toast-viewport')).toBeNull();
    });

    it('keeps action controls tokenized, keyboard visible, and able to wrap', () => {
        showToast({ text: 'Could not locate this message.', action: { label: 'Open', href: 'https://chatgpt.com/c/a' } });
        const css = document.getElementById('aimd-shared-toast-style')?.textContent ?? '';

        expect(css).toContain('pointer-events: auto');
        expect(css).toContain('flex-wrap: wrap');
        expect(css).toContain(':focus-visible');
        expect(css).toContain('var(--aimd-toast-text)');
        expect(css).toContain('var(--aimd-space-2)');
        expect(css).toContain('var(--aimd-size-control-compact)');
    });
});
