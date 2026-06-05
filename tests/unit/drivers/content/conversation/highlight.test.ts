import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('navigation target highlight', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('clears the navigation highlight after one second', async () => {
        const {
            NAVIGATION_HIGHLIGHT_DURATION_MS,
            NAVIGATION_HIGHLIGHT_OUTLINE,
            highlightNavigationTarget,
        } = await import('@/drivers/content/conversation/highlight');
        const element = document.createElement('section');

        highlightNavigationTarget(element);

        expect(NAVIGATION_HIGHLIGHT_DURATION_MS).toBe(1000);
        expect(NAVIGATION_HIGHLIGHT_OUTLINE).toBe('1px dashed color-mix(in srgb, var(--aimd-interactive-primary) 50%, transparent)');
        expect(element.dataset.aimdHighlight).toBe('1');
        expect(element.getAttribute('style')).toContain(`outline: ${NAVIGATION_HIGHLIGHT_OUTLINE}`);
        expect(element.style.outlineOffset).toBe('2px');

        vi.advanceTimersByTime(NAVIGATION_HIGHLIGHT_DURATION_MS - 1);
        expect(element.dataset.aimdHighlight).toBe('1');

        vi.advanceTimersByTime(1);
        expect(element.dataset.aimdHighlight).toBeUndefined();
        expect(element.style.outline).toBe('');
        expect(element.style.outlineOffset).toBe('');
    });

    it('does not let an earlier highlight timer clear a newer highlight', async () => {
        const { NAVIGATION_HIGHLIGHT_DURATION_MS, highlightNavigationTarget } = await import('@/drivers/content/conversation/highlight');
        const element = document.createElement('section');

        highlightNavigationTarget(element);
        vi.advanceTimersByTime(NAVIGATION_HIGHLIGHT_DURATION_MS - 100);
        highlightNavigationTarget(element);

        vi.advanceTimersByTime(100);
        expect(element.dataset.aimdHighlight).toBe('1');
        expect(element.getAttribute('style')).toContain('1px dashed color-mix');

        vi.advanceTimersByTime(NAVIGATION_HIGHLIGHT_DURATION_MS - 101);
        expect(element.dataset.aimdHighlight).toBe('1');

        vi.advanceTimersByTime(1);
        expect(element.dataset.aimdHighlight).toBeUndefined();
    });
});
