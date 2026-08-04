import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ChatGPTAtomicMarkdownCopyShortcut } from '../../../core/settings/types';
import {
    buildPageAtomicSelectionSnapshot,
    type PageAtomicSelectionSnapshot,
} from '../../../services/copy/atomicSelectionMarkdown';
import {
    copyCanonicalMarkdownToClipboard,
    formatCanonicalMarkdownForCopy,
} from '../../../services/copy/canonicalMarkdownCopy';
import {
    resolveStrictRenderedAtomicUnits,
    type RenderedAtomicUnit,
} from '../../../services/reader/atomicSelection';
import { showToast } from '../../../utils/toast';
import { t } from '../components/i18n';

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
    private lastSelection: PageAtomicSelectionSnapshot | null = null;
    private markdownCopyShortcut: ChatGPTAtomicMarkdownCopyShortcut = 'mod-shift-c';
    private pendingModCopy = false;

    constructor(private readonly adapter: SiteAdapter) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureStyle();
        document.addEventListener('selectionchange', this.handleSelectionChange);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        // ChatGPT may rewrite formula clipboard data from a document-level React handler.
        window.addEventListener('copy', this.handleCopy);
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        document.removeEventListener('selectionchange', this.handleSelectionChange);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('copy', this.handleCopy);
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.applySelectedElements([]);
        this.clearSelectionSnapshot();
        document.getElementById(STYLE_ID)?.remove();
    }

    setMarkdownCopyShortcut(shortcut: ChatGPTAtomicMarkdownCopyShortcut): void {
        const next = isChatGPTAtomicMarkdownCopyShortcut(shortcut) ? shortcut : 'none';
        if (this.markdownCopyShortcut === next) return;
        this.markdownCopyShortcut = next;
        this.pendingModCopy = false;
    }

    private readonly handleSelectionChange = (): void => {
        if (this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.syncSelection();
        });
    };

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        if (event.repeat || !isPrimaryCopyKey(event) || isEditableTarget(event.target)) return;
        const snapshot = this.resolveCurrentSelectionSnapshot();
        if (!snapshot) return;

        if (this.markdownCopyShortcut === 'mod-c' && !event.shiftKey) {
            this.pendingModCopy = true;
            return;
        }
        if (this.markdownCopyShortcut !== 'mod-shift-c' || !event.shiftKey) return;

        event.preventDefault();
        void this.handleMarkdownShortcut(snapshot);
    };

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        if (event.key.toLowerCase() === 'c') this.pendingModCopy = false;
    };

    private readonly handleCopy = (event: ClipboardEvent): void => {
        if (this.markdownCopyShortcut !== 'mod-c' || !this.pendingModCopy) return;
        this.pendingModCopy = false;
        if (!event.clipboardData) return;
        const snapshot = this.resolveCurrentSelectionSnapshot();
        if (!snapshot) return;
        const markdown = formatCanonicalMarkdownForCopy(snapshot.canonicalMarkdown);
        if (!markdown) return;
        try {
            event.clipboardData.clearData?.();
            event.clipboardData.setData('text/plain', markdown);
            event.preventDefault();
        } catch {
            // Clipboard failures must leave the host page's native copy path available.
        }
    };

    private syncSelection(): void {
        const context = this.resolveSelectionContext();
        if (context && this.lastSelection && this.isSameSelection(context, this.lastSelection)) {
            this.applySelectedElements(this.lastSelection.units);
            return;
        }
        const selectedUnits = context
            ? resolveStrictRenderedAtomicUnits(context.range, context.root)
            : [];
        const snapshot = context
            ? buildPageAtomicSelectionSnapshot({
                adapter: this.adapter,
                range: context.range,
                root: context.root,
            })
            : null;
        this.applySelectedElements(selectedUnits);
        this.lastSelection = snapshot;
    }

    private async handleMarkdownShortcut(snapshot: PageAtomicSelectionSnapshot): Promise<void> {
        const copied = await copyCanonicalMarkdownToClipboard(snapshot.canonicalMarkdown);
        if (!copied && this.lastSelection === snapshot) this.showCopyFailure();
    }

    private showCopyFailure(): void {
        showToast({
            text: resolveLocalizedLabel(
                t('atomicCopyMarkdownFailed'),
                'atomicCopyMarkdownFailed',
                'The Markdown selection could not be copied.',
            ),
            tone: 'error',
        });
    }

    private resolveCurrentSelectionSnapshot(): PageAtomicSelectionSnapshot | null {
        const context = this.resolveSelectionContext();
        if (!context) return null;
        const selectedUnits = resolveStrictRenderedAtomicUnits(context.range, context.root);
        this.applySelectedElements(selectedUnits);
        if (selectedUnits.length === 0) return null;
        const snapshot = this.lastSelection;
        if (snapshot && this.isSameSelection(context, snapshot)) return snapshot;
        return buildPageAtomicSelectionSnapshot({
            adapter: this.adapter,
            range: context.range,
            root: context.root,
        });
    }

    private clearSelectionSnapshot(): void {
        this.lastSelection = null;
        this.pendingModCopy = false;
    }

    private isSameSelection(context: SelectionContext, snapshot: PageAtomicSelectionSnapshot): boolean {
        const left = snapshot.range;
        const right = context.range;
        return snapshot.root === context.root
            && left.startContainer === right.startContainer
            && left.startOffset === right.startOffset
            && left.endContainer === right.endContainer
            && left.endOffset === right.endOffset;
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
  outline: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 32%, transparent);
  outline-offset: -1px;
}

[data-message-author-role="assistant"][data-message-id] .markdown.prose :is(.katex, .katex-display, code, pre, table, img)[${STATE_ATTRIBUTE}="selected"] {
  background: color-mix(in srgb, var(--aimd-interactive-selected) 96%, transparent);
  outline-color: color-mix(in srgb, var(--aimd-interactive-primary) 44%, transparent);
}
`;
        (document.head || document.documentElement).appendChild(style);
    }
}

function getElementForNode(node: Node): HTMLElement | null {
    if (node instanceof HTMLElement) return node;
    return node.parentElement;
}

function isChatGPTAtomicMarkdownCopyShortcut(value: unknown): value is ChatGPTAtomicMarkdownCopyShortcut {
    return value === 'none' || value === 'mod-c' || value === 'mod-shift-c';
}

function isPrimaryCopyKey(event: KeyboardEvent): boolean {
    return event.key.toLowerCase() === 'c'
        && (event.metaKey || event.ctrlKey)
        && !event.altKey;
}

function isEditableTarget(target: EventTarget | null): boolean {
    const element = target instanceof HTMLElement ? target : document.activeElement;
    if (!(element instanceof HTMLElement)) return false;
    return element instanceof HTMLInputElement
        || element instanceof HTMLTextAreaElement
        || element.isContentEditable
        || Boolean(element.closest('input, textarea, [contenteditable]:not([contenteditable="false"])'));
}

function resolveLocalizedLabel(translated: string, key: string, fallback: string): string {
    return !translated || translated === key ? fallback : translated;
}
