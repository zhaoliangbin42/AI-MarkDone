import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type { ContentSurfaceSelectionEvidenceV1 } from '../../../contracts/contentSurface';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import {
    DOMContentSurfaceAdapter,
    type ContentSurfaceAdapter,
    type ContentSurfaceSelectionCapture,
} from '../../../drivers/content/adapters/ContentSurfaceAdapter';
import type { ChatGPTAtomicMarkdownCopyShortcut } from '../../../core/settings/types';
import {
    buildPageAtomicSelectionSnapshot,
} from '../../../services/copy/atomicSelectionMarkdown';
import {
    copyCanonicalMarkdownToClipboard,
    formatCanonicalMarkdownForCopy,
} from '../../../services/copy/canonicalMarkdownCopy';
import {
    resolveSelectedRenderedAtomicUnits,
    type RenderedAtomicUnit,
} from '../../../services/reader/atomicSelection';
import {
    projectSurfaceSelectionToMarkdown,
} from '../../../services/semantic-content/SurfaceProjection';
import { showToast } from '../../../utils/toast';
import { t } from '../components/i18n';

const STYLE_ID = 'aimd-chatgpt-atomic-selection-style';
const STATE_ATTRIBUTE = 'data-aimd-page-atomic-state';

type PageMarkdownSelectionSnapshot = {
    range: Range;
    root: HTMLElement;
    units: RenderedAtomicUnit[];
    canonicalMarkdown: string;
    evidence: ContentSurfaceSelectionEvidenceV1 | null;
};

export type ChatGPTAtomicSelectionControllerOptions = Readonly<{
    contentSource?: ConversationContentSourceV1 | null;
    materialization?: ConversationMaterializationPortV1 | null;
    surfaceAdapter?: ContentSurfaceAdapter;
}>;

export class ChatGPTAtomicSelectionController {
    private readonly selectedElements = new Set<HTMLElement>();
    private initialized = false;
    private rafId: number | null = null;
    private lastSelection: PageMarkdownSelectionSnapshot | null = null;
    private markdownCopyShortcut: ChatGPTAtomicMarkdownCopyShortcut = 'mod-shift-c';
    private pendingModCopy = false;

    private readonly contentSource: ConversationContentSourceV1 | null;
    private readonly materialization: ConversationMaterializationPortV1 | null;
    private readonly surfaceAdapter: ContentSurfaceAdapter;

    constructor(
        private readonly adapter: SiteAdapter,
        options: ChatGPTAtomicSelectionControllerOptions = {},
    ) {
        this.contentSource = options.contentSource ?? null;
        this.materialization = options.materialization ?? null;
        this.surfaceAdapter = options.surfaceAdapter
            ?? new DOMContentSurfaceAdapter(adapter, this.materialization);
    }

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
        if (!snapshot) {
            if (this.markdownCopyShortcut === 'mod-c' && !event.shiftKey) {
                if (this.hasCanonicalSurfaceEvidence()) this.pendingModCopy = true;
                return;
            }
            if (this.markdownCopyShortcut === 'mod-shift-c' && event.shiftKey) {
                event.preventDefault();
                if (this.hasCanonicalSurfaceEvidence()) this.showCopyFailure();
            }
            return;
        }

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
        if (!snapshot) {
            if (this.hasCanonicalSurfaceEvidence()) {
                event.preventDefault();
                this.showCopyFailure();
            }
            return;
        }
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
        const context = this.surfaceAdapter.captureSelection(window.getSelection());
        if (context && this.lastSelection && this.isSameSelection(context, this.lastSelection)) {
            this.applySelectedElements(this.lastSelection.units);
            return;
        }
        const selectedUnits = context
            ? resolveSelectedRenderedAtomicUnits(context.range, context.root)
            : [];
        const snapshot = context ? this.buildSelectionSnapshot(context, selectedUnits) : null;
        // Atomic recognition is an independent visual contract. Canonical
        // projection controls Markdown copy eligibility only; a stale or
        // unresolved source must not erase a complete rendered atom.
        this.applySelectedElements(selectedUnits);
        this.lastSelection = snapshot;
    }

    private async handleMarkdownShortcut(snapshot: PageMarkdownSelectionSnapshot): Promise<void> {
        if (!this.isSnapshotCurrent(snapshot)) return;
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

    private resolveCurrentSelectionSnapshot(): PageMarkdownSelectionSnapshot | null {
        const context = this.surfaceAdapter.captureSelection(window.getSelection());
        if (!context) return null;
        const selectedUnits = resolveSelectedRenderedAtomicUnits(context.range, context.root);
        const snapshot = this.lastSelection;
        if (snapshot && this.isSameSelection(context, snapshot) && this.isSnapshotCurrent(snapshot)) {
            this.applySelectedElements(snapshot.units);
            return snapshot;
        }
        const next = this.buildSelectionSnapshot(context, selectedUnits);
        this.applySelectedElements(selectedUnits);
        return next;
    }

    private buildSelectionSnapshot(
        context: ContentSurfaceSelectionCapture,
        selectedUnits: RenderedAtomicUnit[],
    ): PageMarkdownSelectionSnapshot | null {
        if (this.contentSource && this.materialization) {
            if (!context.evidence) return null;
            const semantic = projectSurfaceSelectionToMarkdown({
                source: this.contentSource,
                materialization: this.materialization,
                evidence: context.evidence,
            });
            // Once canonical source ports are present, an unresolved or
            // degraded projection must fail open. Reviving DOM reconstruction
            // here would turn ambiguity into apparently canonical output.
            if (semantic.status !== 'ready') return null;
            return {
                range: context.range.cloneRange(),
                root: context.root,
                units: selectedUnits,
                canonicalMarkdown: semantic.markdown,
                evidence: context.evidence,
            };
        }

        const canonicalMarkdown = buildPageAtomicSelectionSnapshot({
            adapter: this.adapter,
            range: context.range,
            root: context.root,
        })?.canonicalMarkdown ?? '';
        if (!canonicalMarkdown) return null;
        return {
            range: context.range.cloneRange(),
            root: context.root,
            units: selectedUnits,
            canonicalMarkdown,
            evidence: null,
        };
    }

    private hasCanonicalSurfaceEvidence(): boolean {
        if (!this.contentSource || !this.materialization) return false;
        return Boolean(this.surfaceAdapter.captureSelection(window.getSelection())?.evidence);
    }

    private clearSelectionSnapshot(): void {
        this.lastSelection = null;
        this.pendingModCopy = false;
    }

    private isSameSelection(
        context: ContentSurfaceSelectionCapture,
        snapshot: PageMarkdownSelectionSnapshot,
    ): boolean {
        const left = snapshot.range;
        const right = context.range;
        return snapshot.root === context.root
            && left.startContainer === right.startContainer
            && left.startOffset === right.startOffset
            && left.endContainer === right.endContainer
            && left.endOffset === right.endOffset
            && sameSurfaceEvidence(snapshot.evidence, context.evidence);
    }

    private isSnapshotCurrent(snapshot: PageMarkdownSelectionSnapshot): boolean {
        if (!snapshot.evidence) return true;
        if (!this.contentSource || !this.materialization) return false;
        const current = this.materialization.read();
        return current.materializationToken === snapshot.evidence.materializationToken
            && current.contentToken === snapshot.evidence.contentToken
            && this.contentSource.isCurrent(snapshot.evidence.contentToken);
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
  --_reader-atomic-selected-bg: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
  --_reader-atomic-selected-bg-strong: color-mix(in srgb, var(--aimd-interactive-selected) 96%, var(--aimd-bg-primary));
  --_reader-atomic-selected-border: color-mix(in srgb, var(--aimd-interactive-primary) 28%, transparent);
  --_reader-atomic-selected-border-strong: color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
  --_reader-atomic-selection-effect: inset 0 0 0 1px var(--_reader-atomic-selected-border);
  --_reader-atomic-selection-strong-effect: inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
  --_reader-atomic-formula-effect: inset 0 -0.22em 0 var(--_reader-atomic-selected-bg-strong), inset 0 0 0 1px var(--_reader-atomic-selected-border-strong);
  border-radius: var(--aimd-radius-sm);
  background: var(--_reader-atomic-selected-bg);
  box-shadow: var(--_reader-atomic-selection-effect);
}

[data-message-author-role="assistant"][data-message-id] .markdown.prose :is(.katex, .katex-display)[${STATE_ATTRIBUTE}="selected"] {
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: var(--_reader-atomic-formula-effect);
}

[data-message-author-role="assistant"][data-message-id] .markdown.prose :is(code, pre, table, img)[${STATE_ATTRIBUTE}="selected"] {
  background: var(--_reader-atomic-selected-bg-strong);
  box-shadow: var(--_reader-atomic-selection-strong-effect);
}
`;
        (document.head || document.documentElement).appendChild(style);
    }
}

function sameSurfaceEvidence(
    left: ContentSurfaceSelectionEvidenceV1 | null,
    right: ContentSurfaceSelectionEvidenceV1 | null,
): boolean {
    if (!left || !right) return left === right;
    return left.contentToken === right.contentToken
        && left.materializationToken === right.materializationToken
        && left.surfaceToken === right.surfaceToken
        && left.target.documentKey === right.target.documentKey
        && left.target.assistantMessageId === right.target.assistantMessageId
        && left.selector.exact === right.selector.exact
        && left.selector.prefix === right.selector.prefix
        && left.selector.suffix === right.selector.suffix;
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
