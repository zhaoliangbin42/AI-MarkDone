import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { buildPageAtomicSelectionMarkdown } from '../../../services/copy/atomicSelectionMarkdown';
import { resolveStrictRenderedAtomicUnits, type RenderedAtomicUnit } from '../../../services/reader/atomicSelection';

const STYLE_ID = 'aimd-chatgpt-atomic-selection-style';
const STATE_ATTRIBUTE = 'data-aimd-page-atomic-state';

type SelectionContext = {
    range: Range;
    root: HTMLElement;
};

export class ChatGPTAtomicSelectionController {
    private readonly selectedElements = new Set<HTMLElement>();
    private initialized = false;
    private rafId: number | null = null;

    constructor(private readonly adapter: SiteAdapter) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureStyle();
        document.addEventListener('selectionchange', this.handleSelectionChange);
        document.addEventListener('copy', this.handleCopy);
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        document.removeEventListener('selectionchange', this.handleSelectionChange);
        document.removeEventListener('copy', this.handleCopy);
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.applySelectedElements([]);
        document.getElementById(STYLE_ID)?.remove();
    }

    private readonly handleSelectionChange = (): void => {
        if (this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.syncSelection();
        });
    };

    private readonly handleCopy = (event: ClipboardEvent): void => {
        if (!event.clipboardData) return;
        const context = this.resolveSelectionContext();
        if (!context) return;
        const selectedUnits = resolveStrictRenderedAtomicUnits(context.range, context.root);
        this.applySelectedElements(selectedUnits);
        if (selectedUnits.length === 0) return;

        const markdown = buildPageAtomicSelectionMarkdown({
            adapter: this.adapter,
            range: context.range,
            root: context.root,
            selectedUnits,
        });
        if (!markdown) return;
        try {
            event.clipboardData.setData('text/plain', markdown);
            event.preventDefault();
        } catch {
            // Clipboard failures must leave the host page's native copy path available.
        }
    };

    private syncSelection(): void {
        const context = this.resolveSelectionContext();
        const selectedUnits = context
            ? resolveStrictRenderedAtomicUnits(context.range, context.root)
            : [];
        this.applySelectedElements(selectedUnits);
    }

    private resolveSelectionContext(): SelectionContext | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return null;

        const startElement = getElementForNode(range.startContainer);
        const endElement = getElementForNode(range.endContainer);
        if (!startElement || !endElement) return null;
        const messageSelector = this.adapter.getMessageSelector();
        const startMessage = startElement.closest(messageSelector);
        const endMessage = endElement.closest(messageSelector);
        if (!(startMessage instanceof HTMLElement) || startMessage !== endMessage) return null;
        if (this.adapter.isStreamingMessage(startMessage)) return null;

        const contentSelector = this.adapter.getMessageContentSelector();
        const roots = [
            ...(startMessage.matches(contentSelector) ? [startMessage] : []),
            ...Array.from(startMessage.querySelectorAll<HTMLElement>(contentSelector)),
        ];
        const root = roots.find((candidate) => (
            candidate.contains(range.startContainer) && candidate.contains(range.endContainer)
        ));
        return root ? { range, root } : null;
    }

    private applySelectedElements(units: RenderedAtomicUnit[]): void {
        const next = new Set(units.map((unit) => unit.element));
        for (const element of this.selectedElements) {
            if (next.has(element)) continue;
            element.removeAttribute(STATE_ATTRIBUTE);
        }
        for (const element of next) {
            if (this.selectedElements.has(element)) continue;
            element.setAttribute(STATE_ATTRIBUTE, 'selected');
        }
        this.selectedElements.clear();
        next.forEach((element) => this.selectedElements.add(element));
    }

    private ensureStyle(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
[data-message-author-role="assistant"][data-message-id] .markdown.prose [${STATE_ATTRIBUTE}="selected"] {
  border-radius: var(--aimd-radius-sm);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 92%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
}

[data-message-author-role="assistant"][data-message-id] .markdown.prose :is(.katex, .katex-display, code, pre, table, img)[${STATE_ATTRIBUTE}="selected"] {
  background: color-mix(in srgb, var(--aimd-interactive-selected) 96%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--aimd-interactive-primary) 44%, transparent);
}
`;
        (document.head || document.documentElement).appendChild(style);
    }
}

function getElementForNode(node: Node): HTMLElement | null {
    if (node instanceof HTMLElement) return node;
    return node.parentElement;
}
