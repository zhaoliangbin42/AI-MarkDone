import { describe, expect, it, vi } from 'vitest';

import { MathClickHandler } from '@/drivers/content/math/math-click';
import { getFormulaPlatformParserAdapter } from '@/runtimes/content/formulaPlatformParsers';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
}

describe('MathClickHandler', () => {
    it('uses one shared document observer instead of one observer per enabled message', () => {
        const originalMutationObserver = globalThis.MutationObserver;
        const observedTargets: Node[] = [];
        class FakeMutationObserver {
            observe(target: Node): void {
                observedTargets.push(target);
            }
            disconnect(): void {}
        }
        vi.stubGlobal('MutationObserver', FakeMutationObserver);
        const containers = Array.from({ length: 3 }, () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            return container;
        });
        const handler = new MathClickHandler();

        try {
            containers.forEach((container) => handler.enable(container));

            expect(observedTargets.filter((target) => containers.includes(target as HTMLElement))).toHaveLength(0);
            const documentObserverCount = observedTargets.filter((target) => target === document.body).length;
            expect(documentObserverCount).toBeGreaterThanOrEqual(1);
            expect(documentObserverCount).toBeLessThanOrEqual(2);
        } finally {
            handler.disable();
            containers.forEach((container) => container.remove());
            vi.stubGlobal('MutationObserver', originalMutationObserver);
        }
    });

    it('does not rescan a container that is already enabled', () => {
        const container = document.createElement('div');
        container.innerHTML = '<span class="katex"><annotation encoding="application/x-tex">x</annotation></span>';
        document.body.appendChild(container);
        const querySelectorAll = vi.spyOn(container, 'querySelectorAll');
        const handler = new MathClickHandler();

        try {
            handler.enable(container);
            const firstScanQueries = querySelectorAll.mock.calls.length;
            handler.enable(container);

            expect(firstScanQueries).toBeGreaterThan(0);
            expect(querySelectorAll.mock.calls.length).toBe(firstScanQueries);
        } finally {
            handler.disable();
            querySelectorAll.mockRestore();
            container.remove();
        }
    });

    it('discovers future matching content containers without a caller-owned observer', async () => {
        vi.useFakeTimers();
        const { writeText } = setClipboardMock();
        const root = document.createElement('main');
        document.body.appendChild(root);
        const handler = new MathClickHandler();

        try {
            (handler as any).observeContainers(root, '.assistant-message');
            const message = document.createElement('div');
            message.className = 'assistant-message';
            message.innerHTML = '<span class="katex-error">\\gamma_2</span>';
            root.appendChild(message);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(20);

            const formula = message.querySelector<HTMLElement>('.katex-error')!;
            formula.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await Promise.resolve();

            expect(writeText).toHaveBeenCalledWith('$\\gamma_2$');
        } finally {
            handler.disable();
            root.remove();
            vi.useRealTimers();
        }
    });

    it('stops observing a message after its container leaves the page', async () => {
        vi.useFakeTimers();
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const handler = new MathClickHandler();

        try {
            handler.enable(container);
            container.remove();
            await Promise.resolve();

            const detachedFormula = document.createElement('span');
            detachedFormula.className = 'katex-error';
            detachedFormula.textContent = '\\gamma_1';
            container.appendChild(detachedFormula);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(20);

            detachedFormula.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await Promise.resolve();
            expect(writeText).not.toHaveBeenCalled();
        } finally {
            handler.disable();
            container.remove();
            vi.useRealTimers();
        }
    });

    it('keeps observing a message that is reparented within the page', async () => {
        vi.useFakeTimers();
        const { writeText } = setClipboardMock();
        const firstParent = document.createElement('div');
        const secondParent = document.createElement('div');
        const container = document.createElement('div');
        firstParent.appendChild(container);
        document.body.append(firstParent, secondParent);
        const handler = new MathClickHandler();

        try {
            handler.enable(container);
            secondParent.appendChild(container);
            await Promise.resolve();

            const formula = document.createElement('span');
            formula.className = 'katex-error';
            formula.textContent = '\\delta_1';
            container.appendChild(formula);
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(20);

            formula.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await Promise.resolve();
            expect(writeText).toHaveBeenCalledWith('$\\delta_1$');
        } finally {
            handler.disable();
            firstParent.remove();
            secondParent.remove();
            vi.useRealTimers();
        }
    });

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

        expect(writeText).toHaveBeenCalledWith('$x_1 + y$');
        const toast = document.body.querySelector<HTMLElement>('.aimd-toast');
        expect(toast).toBeTruthy();
        expect(toast?.textContent).toContain('Copied');
        expect(document.body.querySelector('.aimd-tooltip[data-variant="ephemeral"]')).toBeNull();
        handler.disable();
        container.remove();
        document.documentElement.style.removeProperty('--aimd-interactive-highlight');
        document.documentElement.style.removeProperty('--aimd-interactive-flash');
    });

    it('copies LaTeX from MathJax containers with platform source attributes', async () => {
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        const math = document.createElement('mjx-container');
        math.setAttribute('data-latex', '\\int_0^1 x dx');
        container.appendChild(math);
        document.body.appendChild(container);

        const handler = new MathClickHandler();
        handler.enable(container);

        const target = container.querySelector('mjx-container') as HTMLElement;
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('$\\int_0^1 x dx$');
        handler.disable();
        container.remove();
    });

    it('uses an injected platform parser for formula discovery and extraction', async () => {
        const { writeText } = setClipboardMock();
        const parserAdapter = {
            isMathNode: vi.fn((node: Element) => node.classList.contains('platform-math')),
            extractLatex: vi.fn((_node: HTMLElement) => ({ latex: '\\sqrt{x}', isBlock: true })),
            isBlockMath: vi.fn(() => true),
        };
        const onFormulaHoverEnter = vi.fn();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="katex" data-latex-source="wrong"></span>
          <span class="platform-math katex"></span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ parserAdapter, onFormulaHoverEnter });
        handler.enable(container);

        const ignored = container.querySelector('[data-latex-source]') as HTMLElement;
        ignored.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();
        expect(writeText).not.toHaveBeenCalled();

        const target = container.querySelector('.platform-math') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(onFormulaHoverEnter).toHaveBeenCalledWith(expect.objectContaining({
            source: '\\sqrt{x}',
            displayMode: true,
        }));
        expect(writeText).toHaveBeenCalledWith('$$\n\\sqrt{x}\n$$');
        expect(parserAdapter.extractLatex).toHaveBeenCalledWith(target);
        handler.disable();
        container.remove();
    });

    it('restores the DeepSeek KaTeX annotation chain for click copy', async () => {
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        container.className = 'ds-markdown';
        container.innerHTML = `
          <span class="katex-display">
            <span class="katex">
              <span class="katex-mathml">
                <math><semantics><mrow></mrow><annotation encoding="application/x-tex">\\sum_i x_i</annotation></semantics></math>
              </span>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ parserAdapter: getFormulaPlatformParserAdapter('deepseek') });
        handler.enable(container);

        const target = container.querySelector('.katex-display') as HTMLElement;
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('$$\n\\sum_i x_i\n$$');
        handler.disable();
        container.remove();
    });

    it('restores the Gemini top-level data-math chain without binding nested rendered children', async () => {
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="math-inline" data-math="\\frac{1}{2}">
            <span class="katex"><span class="katex-html">rendered</span></span>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ parserAdapter: getFormulaPlatformParserAdapter('gemini') });
        handler.enable(container);

        const nested = container.querySelector('.katex') as HTMLElement;
        nested.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('$\\frac{1}{2}$');
        handler.disable();
        container.remove();
    });

    it('restores the Claude shared KaTeX parser chain for hover and click', async () => {
        const { writeText } = setClipboardMock();
        const onFormulaHoverEnter = vi.fn();
        const container = document.createElement('div');
        container.className = 'font-claude-response';
        container.innerHTML = `
          <span class="katex">
            <annotation encoding="application/x-tex">\\sqrt{x}</annotation>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({
            parserAdapter: getFormulaPlatformParserAdapter('claude'),
            onFormulaHoverEnter,
        });
        handler.enable(container);

        const target = container.querySelector('.katex') as HTMLElement;
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(onFormulaHoverEnter).toHaveBeenCalledWith(expect.objectContaining({
            source: '\\sqrt{x}',
            displayMode: false,
        }));
        expect(writeText).toHaveBeenCalledWith('$\\sqrt{x}$');
        handler.disable();
        container.remove();
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

    it('copies raw LaTeX when raw source format is selected', async () => {
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="katex-display">
            <span class="katex">
              <annotation encoding="application/x-tex">\\sum_i x_i</annotation>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ clickCopyFormulaFormat: 'raw' });
        handler.enable(container);

        const target = container.querySelector('.katex-display') as HTMLElement;
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('\\sum_i x_i');
        handler.disable();
        container.remove();
    });

    it('copies display LaTeX with equation wrappers when selected', async () => {
        const { writeText } = setClipboardMock();
        const container = document.createElement('div');
        container.innerHTML = `
          <span class="katex-display">
            <span class="katex">
              <annotation encoding="application/x-tex">a^2+b^2=c^2</annotation>
            </span>
          </span>
        `;
        document.body.appendChild(container);

        const handler = new MathClickHandler({ clickCopyFormulaFormat: 'equation-star' });
        handler.enable(container);

        const target = container.querySelector('.katex-display') as HTMLElement;
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        expect(writeText).toHaveBeenCalledWith('\\begin{equation*}\na^2+b^2=c^2\n\\end{equation*}');
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

        expect(writeText).toHaveBeenCalledWith('$\\alpha_1$');

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
