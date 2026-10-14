import { afterEach, describe, expect, it, vi } from 'vitest';
import { SurfaceFocusLifecycle } from '@/ui/content/components/surfaceFocusLifecycle';
import { markTransientRoot } from '@/ui/content/components/transientUi';

afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
});

describe('SurfaceFocusLifecycle', () => {
    it('does not let delayed initial focus steal a shared fallback action from the user', async () => {
        vi.useFakeTimers();
        const surface = document.createElement('div');
        const input = document.createElement('textarea');
        surface.append(input);
        const toast = markTransientRoot(document.createElement('div'));
        const link = document.createElement('a');
        link.href = 'https://chatgpt.com/c/conversation-1?messageId=assistant-1';
        toast.append(link);
        document.body.append(surface, toast);
        const focus = new SurfaceFocusLifecycle();
        focus.scheduleInitialFocus({ surface, selectors: ['textarea'], delayMs: 50 });
        link.focus();
        await vi.advanceTimersByTimeAsync(50);
        expect(document.activeElement).toBe(link);
        focus.clear();
    });

    it('still performs preferred initial focus inside its own transient surface', async () => {
        vi.useFakeTimers();
        const surface = markTransientRoot(document.createElement('div'));
        surface.tabIndex = -1;
        const input = document.createElement('textarea');
        surface.append(input);
        document.body.append(surface);
        surface.focus();
        const focus = new SurfaceFocusLifecycle();
        focus.scheduleInitialFocus({ surface, selectors: ['textarea'], delayMs: 50 });
        await vi.advanceTimersByTimeAsync(50);
        expect(document.activeElement).toBe(input);
        focus.clear();
    });

    it('preserves composition focus in a newer transient input inside a shadow root', async () => {
        vi.useFakeTimers();
        const surface = document.createElement('div');
        surface.append(document.createElement('textarea'));
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const transient = markTransientRoot(document.createElement('div'));
        const composing = document.createElement('textarea');
        composing.value = '正在输入中文';
        transient.append(composing);
        shadow.append(transient);
        document.body.append(surface, host);
        const focus = new SurfaceFocusLifecycle();
        focus.scheduleInitialFocus({ surface, selectors: ['textarea'], delayMs: 50 });
        composing.focus();
        composing.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true, data: '中' }));
        await vi.advanceTimersByTimeAsync(50);
        expect(shadow.activeElement).toBe(composing);
        expect(composing.value).toBe('正在输入中文');
        composing.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true, data: '中文' }));
        focus.clear();
    });
});
