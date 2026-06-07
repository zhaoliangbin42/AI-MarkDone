import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AIMD_VIEWPORT_RESIZE_IDLE_EVENT,
    ViewportResizeSuspendController,
} from '@/ui/content/controllers/ViewportResizeSuspendController';

function setViewportWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

describe('ViewportResizeSuspendController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.head.innerHTML = '';
        document.documentElement.removeAttribute('data-aimd-viewport-resizing');
        setViewportWidth(1000);
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.head.innerHTML = '';
        document.documentElement.removeAttribute('data-aimd-viewport-resizing');
    });

    it('ignores small width changes so vertical chrome or keyboard resizes do not suspend the UI', () => {
        const idle = vi.fn();
        window.addEventListener(AIMD_VIEWPORT_RESIZE_IDLE_EVENT, idle);
        const controller = new ViewportResizeSuspendController();
        controller.init();

        setViewportWidth(1007);
        window.dispatchEvent(new Event('resize'));
        vi.advanceTimersByTime(500);

        expect(document.documentElement.dataset.aimdViewportResizing).toBeUndefined();
        expect(idle).not.toHaveBeenCalled();
        controller.dispose();
        window.removeEventListener(AIMD_VIEWPORT_RESIZE_IDLE_EVENT, idle);
    });

    it('enters suspend immediately when the width changes beyond the threshold', () => {
        const controller = new ViewportResizeSuspendController();
        controller.init();

        setViewportWidth(1010);
        window.dispatchEvent(new Event('resize'));

        expect(document.documentElement.dataset.aimdViewportResizing).toBe('1');
        controller.dispose();
    });

    it('clears suspend and dispatches one idle event after the resize settles', () => {
        const idle = vi.fn();
        window.addEventListener(AIMD_VIEWPORT_RESIZE_IDLE_EVENT, idle);
        const controller = new ViewportResizeSuspendController();
        controller.init();

        setViewportWidth(1012);
        window.dispatchEvent(new Event('resize'));
        expect(document.documentElement.dataset.aimdViewportResizing).toBe('1');

        setViewportWidth(1030);
        window.dispatchEvent(new Event('resize'));
        vi.advanceTimersByTime(999);
        expect(document.documentElement.dataset.aimdViewportResizing).toBe('1');
        expect(idle).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(document.documentElement.dataset.aimdViewportResizing).toBeUndefined();
        expect(idle).toHaveBeenCalledTimes(1);
        controller.dispose();
        window.removeEventListener(AIMD_VIEWPORT_RESIZE_IDLE_EVENT, idle);
    });

    it('installs CSS that hides only AI-MarkDone chrome during viewport resizing', () => {
        const controller = new ViewportResizeSuspendController();
        controller.init();

        const css = document.getElementById('aimd-viewport-resize-suspend-style')?.textContent ?? '';

        expect(css).toContain('html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-directory-rail');
        expect(css).toContain('html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-directory-preview');
        expect(css).not.toContain('#aimd-chatgpt-directory-step-controls');
        expect(css).toContain('html[data-aimd-viewport-resizing="1"] #aimd-chatgpt-message-stepper');
        expect(css).toContain('html[data-aimd-viewport-resizing="1"] .aimd-message-toolbar-host[data-aimd-placement="actionbar"]');
        expect(css).toContain('visibility: hidden;');
        expect(css).toContain('content-visibility: hidden;');
        expect(css).not.toContain('display: none;');
        controller.dispose();
    });

    it('removes timers, listeners, and the resizing marker on dispose', () => {
        const controller = new ViewportResizeSuspendController();
        controller.init();

        setViewportWidth(1012);
        window.dispatchEvent(new Event('resize'));
        expect(document.documentElement.dataset.aimdViewportResizing).toBe('1');

        controller.dispose();
        expect(document.documentElement.dataset.aimdViewportResizing).toBeUndefined();

        setViewportWidth(1040);
        window.dispatchEvent(new Event('resize'));
        vi.advanceTimersByTime(500);
        expect(document.documentElement.dataset.aimdViewportResizing).toBeUndefined();
    });
});
