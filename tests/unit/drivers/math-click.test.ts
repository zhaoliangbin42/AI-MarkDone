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
    it('emits hover context from the same extracted LaTeX source', () => {
        const onFormulaHoverEnter = vi.fn();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="math-inline">
            <span class="katex">
              <annotation encoding="application/x-tex">x_1 + y</annotation>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ onFormulaHoverEnter });
        handler.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(onFormulaHoverEnter).toHaveBeenCalledWith(expect.objectContaining({
            element: container.querySelector('.math-inline'),
            anchor: target,
            source: 'x_1 + y',
            displayMode: false,
        }));

        handler.disable();
        container.remove();
    });

    it('uses the resolved interactive highlight token for inline formula hover', () => {
        document.documentElement.style.setProperty('--aimd-interactive-highlight', 'rgba(37, 99, 235, 0.12)');
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="math-inline">
            <span class="katex">
              <annotation encoding="application/x-tex">x_1 + y</annotation>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler();
        handler.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        expect(target).toBeTruthy();

        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

        expect(target.style.backgroundColor).toBe('rgba(37, 99, 235, 0.12)');

        handler.disable();
        container.remove();
        document.documentElement.style.removeProperty('--aimd-interactive-highlight');
    });

    it('copies LaTeX from annotation on click', async () => {
        const { writeText } = setClipboardMock();
        document.documentElement.style.setProperty('--aimd-interactive-highlight', 'rgba(37, 99, 235, 0.12)');
        document.documentElement.style.setProperty('--aimd-interactive-flash', 'rgba(37, 99, 235, 0.24)');

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

        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        expect(target.style.backgroundColor).toBe('rgba(37, 99, 235, 0.12)');

        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();
        await Promise.resolve();

        expect(target.style.backgroundColor).toBe('rgba(37, 99, 235, 0.24)');

        expect(writeText).toHaveBeenCalledWith('x_1 + y');
        const tooltip = document.body.querySelector<HTMLElement>('.aimd-tooltip[data-variant="ephemeral"]');
        expect(tooltip).toBeTruthy();
        expect(tooltip?.textContent).toContain('Copied');
        handler.disable();
        container.remove();
        document.documentElement.style.removeProperty('--aimd-interactive-highlight');
        document.documentElement.style.removeProperty('--aimd-interactive-flash');
    });

    it('does not intercept formula clicks when Markdown click-copy is disabled', async () => {
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="katex">
            <annotation encoding="application/x-tex">x_1 + y</annotation>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ clickCopyMarkdown: false });
        handler.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        const allowed = target.dispatchEvent(click);
        await Promise.resolve();

        expect(allowed).toBe(true);
        expect(click.defaultPrevented).toBe(false);
        expect(writeText).not.toHaveBeenCalled();

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

    it('calls requestIdleCallback and cancelIdleCallback with window binding for Firefox', async () => {
        vi.useFakeTimers();
        const originalRequestIdleCallback = (window as any).requestIdleCallback;
        const originalCancelIdleCallback = (window as any).cancelIdleCallback;
        const callbacks = new Map<number, () => void>();
        let nextId = 0;
        const requestIdleCallback = vi.fn(function (
            this: Window,
            callback: () => void,
            _opts?: { timeout: number }
        ) {
            expect(this).toBe(window);
            const id = ++nextId;
            callbacks.set(id, callback);
            return id;
        });
        const cancelIdleCallback = vi.fn(function (this: Window, id: number) {
            expect(this).toBe(window);
            callbacks.delete(id);
        });
        (window as any).requestIdleCallback = requestIdleCallback;
        (window as any).cancelIdleCallback = cancelIdleCallback;

        const container = document.createElement('div');
        document.body.appendChild(container);
        const handler = new MathClickHandler();

        try {
            handler.enable(container);

            const newNode = document.createElement('span');
            newNode.className = 'katex-error';
            newNode.textContent = '\\beta_1';
            container.appendChild(newNode);

            await Promise.resolve();

            expect(requestIdleCallback).toHaveBeenCalledTimes(1);
            handler.disable();
            expect(cancelIdleCallback).toHaveBeenCalledWith(1);
        } finally {
            handler.disable();
            container.remove();
            (window as any).requestIdleCallback = originalRequestIdleCallback;
            (window as any).cancelIdleCallback = originalCancelIdleCallback;
            vi.useRealTimers();
        }
    });
});
