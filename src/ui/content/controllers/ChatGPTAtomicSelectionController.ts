import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import {
    buildPageAtomicSelectionSnapshot,
    type PageAtomicSelectionSnapshot,
} from '../../../services/copy/atomicSelectionMarkdown';
import type {
    AtomicSelectionRichPayload,
    CanonicalMarkdownRichPayloadParams,
} from '../../../services/copy/atomicSelectionRichHtml';
import { copyRichTextToClipboard } from '../../../drivers/content/clipboard/copyRichTextToClipboard';
import {
    DEFAULT_FORMULA_RICH_COPY_FORMAT,
    normalizeFormulaRichCopyFormat,
    type FormulaRichCopyFormat,
} from '../../../core/settings/formula';
import {
    resolveStrictRenderedAtomicUnits,
    type RenderedAtomicUnit,
} from '../../../services/reader/atomicSelection';
import type { AppearanceSnapshot } from '../../../style/appearance';
import { showToast } from '../../../utils/toast';
import { t } from '../components/i18n';
import { ToolbarHoverActionPortal } from '../components/ToolbarHoverActionPortal';

const STYLE_ID = 'aimd-chatgpt-atomic-selection-style';
const STATE_ATTRIBUTE = 'data-aimd-page-atomic-state';

type SelectionContext = {
    range: Range;
    root: HTMLElement;
};

export type AtomicSelectionRichPayloadBuilder = (
    params: CanonicalMarkdownRichPayloadParams,
) => Promise<AtomicSelectionRichPayload | null>;

export class ChatGPTAtomicSelectionController {
    private readonly selectedElements = new Set<HTMLElement>();
    private readonly richCopyPortal = new ToolbarHoverActionPortal('light');
    private initialized = false;
    private rafId: number | null = null;
    private lastSelection: PageAtomicSelectionSnapshot | null = null;
    private richCopyFormulaFormat: FormulaRichCopyFormat = DEFAULT_FORMULA_RICH_COPY_FORMAT;

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly buildRichPayload: AtomicSelectionRichPayloadBuilder,
    ) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureStyle();
        document.addEventListener('selectionchange', this.handleSelectionChange);
        // ChatGPT may rewrite formula clipboard data from a document-level React handler.
        window.addEventListener('copy', this.handleCopy);
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        document.removeEventListener('selectionchange', this.handleSelectionChange);
        window.removeEventListener('copy', this.handleCopy);
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.applySelectedElements([]);
        this.clearRichCopy();
        document.getElementById(STYLE_ID)?.remove();
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        this.richCopyPortal.setAppearance(snapshot);
    }

    setRichCopyFormulaFormat(format: FormulaRichCopyFormat): void {
        const next = normalizeFormulaRichCopyFormat(format);
        this.richCopyFormulaFormat = next;
        // Runtime formula-settings delivery also invalidates the snapshot's
        // canonical Markdown representation, even when this rich format did not change.
        if (!this.lastSelection) return;
        const context = this.resolveSelectionContext();
        const snapshot = context
            ? buildPageAtomicSelectionSnapshot({
                adapter: this.adapter,
                range: context.range,
                root: context.root,
            })
            : null;
        this.applySelectedElements(
            context ? resolveStrictRenderedAtomicUnits(context.range, context.root) : [],
        );
        this.syncRichCopy(snapshot);
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
        const snapshot = this.lastSelection && this.isSameSelection(context, this.lastSelection)
            ? this.lastSelection
            : buildPageAtomicSelectionSnapshot({
                adapter: this.adapter,
                range: context.range,
                root: context.root,
            });
        if (!snapshot) return;
        try {
            event.clipboardData.clearData?.();
            event.clipboardData.setData('text/plain', snapshot.markdown);
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
        this.syncRichCopy(snapshot);
    }

    private syncRichCopy(snapshot: PageAtomicSelectionSnapshot | null): void {
        this.lastSelection = snapshot;
        this.richCopyPortal.close();

        if (!snapshot) return;
        this.openRichCopyAction(snapshot);
    }

    private openRichCopyAction(snapshot: PageAtomicSelectionSnapshot): void {
        const rect = resolveSelectionRect(snapshot.range, snapshot.units);
        if (!rect) return;
        const richLabel = resolveLocalizedLabel(t('atomicCopyRich'), 'atomicCopyRich', 'Copy with formatting');
        const richTooltip = resolveLocalizedLabel(
            t('atomicCopyRichTooltip'),
            'atomicCopyRichTooltip',
            'Copy cleaned basic HTML using the configured formula source format',
        );
        this.richCopyPortal.open({
            anchorEl: snapshot.root,
            anchorRect: rect,
            actions: [{
                id: 'copy-rich-selection',
                label: richLabel,
                displayLabel: richLabel,
                tooltip: richTooltip,
                showLabel: true,
                onClick: () => { void this.handleRichCopy(); },
            }],
            onRequestClose: () => this.richCopyPortal.close(),
        });
    }

    private async handleRichCopy(): Promise<void> {
        const snapshot = this.lastSelection;
        if (!snapshot) {
            this.showRichCopyWriteFailure();
            return;
        }

        let payload: AtomicSelectionRichPayload | null;
        try {
            payload = await this.buildRichPayload({
                canonicalMarkdown: snapshot.canonicalMarkdown,
                plainText: snapshot.markdown,
                formulaFormat: this.richCopyFormulaFormat,
            });
        } catch {
            if (this.lastSelection === snapshot) this.showRichCopyWriteFailure();
            return;
        }
        if (this.lastSelection !== snapshot) return;
        if (!payload) {
            this.showRichCopyWriteFailure();
            return;
        }
        const result = await copyRichTextToClipboard({
            html: payload.html,
            plainText: payload.plainText,
        });
        if (!result.ok) {
            this.showRichCopyWriteFailure();
            return;
        }
        this.richCopyPortal.close();
    }

    private showRichCopyWriteFailure(): void {
        showToast({
            text: resolveLocalizedLabel(
                t('atomicCopyRichWriteFailed'),
                'atomicCopyRichWriteFailed',
                'Formatted content and equations could not be written. Markdown was not copied.',
            ),
            tone: 'error',
        });
    }

    private clearRichCopy(): void {
        this.lastSelection = null;
        this.richCopyPortal.close();
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

function resolveLocalizedLabel(translated: string, key: string, fallback: string): string {
    return !translated || translated === key ? fallback : translated;
}

function resolveSelectionRect(range: Range, units: RenderedAtomicUnit[]): DOMRect | null {
    const rects = typeof range.getClientRects === 'function'
        ? Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0)
        : [];
    if (rects.length > 0) {
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        return makeRect(left, top, right, bottom);
    }
    const first = units[0]?.element;
    return first?.getBoundingClientRect() ?? null;
}

function makeRect(left: number, top: number, right: number, bottom: number): DOMRect {
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    if (typeof DOMRect === 'function') return new DOMRect(left, top, width, height);
    return {
        left,
        top,
        right,
        bottom,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({ left, top, right, bottom, width, height, x: left, y: top }),
    } as DOMRect;
}
