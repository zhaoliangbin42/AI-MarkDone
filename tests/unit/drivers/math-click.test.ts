import { describe, expect, it, vi } from 'vitest';
import { MathClickHandler } from '@/drivers/content/math/math-click';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
}

describe('MathClickHandler', () => {
    it('copies LaTeX from annotation on click', async () => {
        const { writeText } = setClipboardMock();

        const container = document.createElement('div');
        container.innerHTML = `
          <span class="katex">
            <annotation encoding="application/x-tex">x_1 + y</annotation>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler();
        handler.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        expect(target).toBeTruthy();

        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('x_1 + y');
        handler.disable();
        container.remove();
    });

    it('observes streaming DOM updates and attaches to new math nodes', async () => {
        vi.useFakeTimers();
        const { writeText } = setClipboardMock();

        const container = document.createElement('div');
        document.body.appendChild(container);

        const handler = new MathClickHandler();
        handler.enable(container);

        const newNode = document.createElement('span');
        newNode.className = 'katex-error';
        newNode.textContent = '\\alpha_1';
        container.appendChild(newNode);

        // Allow MutationObserver to run and schedule flush.
        await Promise.resolve();

        // Flush queued processing (fallback timer path).
        await vi.advanceTimersByTimeAsync(20);

        newNode.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('\\alpha_1');

        handler.disable();
        container.remove();
        vi.useRealTimers();
    });
});
