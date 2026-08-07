import type {
    ContentSurfaceSelectionEvidenceV1,
    ContentSurfaceSelectionEvidenceV2,
} from '../../../contracts/contentSurface';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import type { ConversationDiscoveryPortV2 } from '../../../contracts/conversationDiscoveryV2';
import type { SiteAdapter } from './base';

const QUOTE_CONTEXT_LENGTH = 96;

export type ContentSurfaceSelectionCapture = Readonly<{
    range: Range;
    root: HTMLElement;
    messageElement: HTMLElement;
    evidence: ContentSurfaceSelectionEvidenceV1 | null;
}>;

export interface ContentSurfaceAdapter {
    captureSelection(selection: Selection | null): ContentSurfaceSelectionCapture | null;
}

/**
 * Converts a captured browser Range into V2 evidence without making the
 * Range or DOM node an identity.  The discovery port supplies the entry and
 * sealed turn; the Range contributes only quote, rendered offsets, and
 * source-bearing formula atoms.
 */
export function resolveV2SelectionEvidence(
    context: ContentSurfaceSelectionCapture,
    discovery: ConversationDiscoveryPortV2,
    site: SiteAdapter,
): ContentSurfaceSelectionEvidenceV2 | null {
    const ref = discovery.resolveElement(context.messageElement);
    if (!ref) return null;
    const snapshot = discovery.read();
    if (snapshot.kind !== 'ready') return null;
    const entry = snapshot.entries.find((candidate) => (
        candidate.ref.documentEpochId === ref.documentEpochId
        && candidate.ref.projectionId === ref.projectionId
        && candidate.ref.slotKey === ref.slotKey
    ));
    if (!entry || entry.content.kind !== 'ready') return null;
    const materialized = entry.materialization.assistant;
    if (!materialized || materialized.messageElement !== context.messageElement) return null;
    const turn = discovery.readTurn({ kind: 'entry', ref });
    if (turn.kind !== 'ready' || turn.turn.turnToken !== entry.content.turnToken) return null;

    const quote = context.evidence?.selector ?? createQuoteFromRange(context.range, context.root);
    if (!quote) return null;
    const fragments = context.evidence?.atomicFragments ?? captureFormulaFragments(
        context.range,
        context.root,
        site,
    );
    const occurrences = new Map<string, number>();
    const atoms = fragments.map((fragment) => {
        const key = `${fragment.isBlock ? 'display' : 'inline'}:${fragment.latex.trim()}`;
        const occurrence = (occurrences.get(key) ?? 0) + 1;
        occurrences.set(key, occurrence);
        return Object.freeze({
            kind: 'formula' as const,
            latex: fragment.latex.trim(),
            renderedText: fragment.renderedText,
            display: fragment.isBlock,
            occurrence,
        });
    });
    const offsets = resolveRenderedOffsets(context.range, context.root);
    if (!offsets) return null;
    return Object.freeze({
        ref,
        turnToken: turn.turn.turnToken,
        surfaceToken: materialized.surfaceToken,
        quote,
        position: offsets,
        atoms: Object.freeze(atoms),
    });
}

/**
 * Shared DOM implementation. Platform structure remains behind SiteAdapter;
 * the emitted evidence contains only typed identity, revision tokens, and a
 * W3C-style text quote.
 */
export class DOMContentSurfaceAdapter implements ContentSurfaceAdapter {
    private readonly rootIds = new WeakMap<HTMLElement, string>();
    private nextRootId = 0;

    constructor(
        private readonly site: SiteAdapter,
        private readonly materialization: ConversationMaterializationPortV1 | null,
    ) {}

    captureSelection(selection: Selection | null): ContentSurfaceSelectionCapture | null {
        if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return null;

        const startElement = getElementForNode(range.startContainer);
        const endElement = getElementForNode(range.endContainer);
        if (!startElement || !endElement) return null;
        const messageSelector = this.site.getMessageSelector();
        const startMessage = startElement.closest(messageSelector);
        const endMessage = endElement.closest(messageSelector);
        if (!(startMessage instanceof HTMLElement) || startMessage !== endMessage) return null;
        if (this.site.isStreamingMessage(startMessage)) return null;

        const contentSelector = this.site.getMessageContentSelector();
        const roots = [
            ...(startMessage.matches(contentSelector) ? [startMessage] : []),
            ...Array.from(startMessage.querySelectorAll<HTMLElement>(contentSelector)),
        ];
        const root = roots.find((candidate) => (
            candidate.contains(range.startContainer) && candidate.contains(range.endContainer)
        ));
        if (!root) return null;

        return Object.freeze({
            range,
            root,
            messageElement: startMessage,
            evidence: this.captureSemanticEvidence(range, root, startMessage),
        });
    }

    private captureSemanticEvidence(
        range: Range,
        root: HTMLElement,
        messageElement: HTMLElement,
    ): ContentSurfaceSelectionEvidenceV1 | null {
        const materialization = this.materialization;
        if (!materialization) return null;
        const target = materialization.resolveElement(messageElement);
        const snapshot = materialization.read();
        if (!target || !snapshot.contentToken) return null;

        const exact = normalizeSurfaceText(range.toString());
        if (!exact) return null;
        const prefix = readRangeContext(root, range, 'prefix');
        const suffix = readRangeContext(root, range, 'suffix');
        const rootId = this.getRootId(root);
        const atomicFragments = captureFormulaFragments(range, root, this.site);
        return Object.freeze({
            target: Object.freeze({ ...target }),
            contentToken: snapshot.contentToken,
            materializationToken: snapshot.materializationToken,
            surfaceToken: `${this.site.getPlatformId()}:surface:${rootId}`,
            selector: Object.freeze({
                kind: 'text-quote',
                exact,
                ...(prefix ? { prefix } : {}),
                ...(suffix ? { suffix } : {}),
            }),
            ...(atomicFragments.length > 0 ? { atomicFragments } : {}),
        });
    }

    private getRootId(root: HTMLElement): string {
        const current = this.rootIds.get(root);
        if (current) return current;
        const next = String(++this.nextRootId);
        this.rootIds.set(root, next);
        return next;
    }
}

function readRangeContext(
    root: HTMLElement,
    range: Range,
    side: 'prefix' | 'suffix',
): string {
    try {
        const context = root.ownerDocument.createRange();
        context.selectNodeContents(root);
        if (side === 'prefix') {
            context.setEnd(range.startContainer, range.startOffset);
            return normalizeSurfaceText(context.toString()).slice(-QUOTE_CONTEXT_LENGTH);
        }
        context.setStart(range.endContainer, range.endOffset);
        return normalizeSurfaceText(context.toString()).slice(0, QUOTE_CONTEXT_LENGTH);
    } catch {
        return '';
    }
}

function createQuoteFromRange(
    range: Range,
    root: HTMLElement,
): ContentSurfaceSelectionEvidenceV1['selector'] | null {
    const exact = normalizeSurfaceText(range.toString());
    if (!exact) return null;
    const prefix = readRangeContext(root, range, 'prefix');
    const suffix = readRangeContext(root, range, 'suffix');
    return Object.freeze({
        kind: 'text-quote' as const,
        exact,
        ...(prefix ? { prefix } : {}),
        ...(suffix ? { suffix } : {}),
    });
}

function resolveRenderedOffsets(
    range: Range,
    root: HTMLElement,
): Readonly<{ start: number; end: number; unit: 'unicode-code-point' }> | null {
    try {
        const before = root.ownerDocument.createRange();
        before.selectNodeContents(root);
        before.setEnd(range.startContainer, range.startOffset);
        const selected = range.toString();
        const beforeText = normalizeSurfaceText(before.toString());
        const exact = normalizeSurfaceText(selected);
        if (!exact) return null;
        const start = Array.from(beforeText).length;
        return Object.freeze({
            start,
            end: start + Array.from(exact).length,
            unit: 'unicode-code-point' as const,
        });
    } catch {
        return null;
    }
}

function normalizeSurfaceText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function captureFormulaFragments(
    range: Range,
    root: HTMLElement,
    site: SiteAdapter,
): ReadonlyArray<{
    kind: 'formula';
    renderedText: string;
    latex: string;
    isBlock: boolean;
}> {
    const parser = site.getMarkdownParserAdapter();
    if (!parser) return [];

    const fragments: Array<{
        kind: 'formula';
        renderedText: string;
        latex: string;
        isBlock: boolean;
    }> = [];
    const candidates = [
        ...(parser.isMathNode(root) ? [root] : []),
        ...Array.from(root.querySelectorAll<HTMLElement>('*')),
    ];
    for (const candidate of candidates) {
        if (!parser.isMathNode(candidate)) continue;
        const extracted = parser.extractLatex(candidate);
        const renderedText = normalizeSurfaceText(candidate.textContent ?? '');
        const latex = extracted?.latex.trim() ?? '';
        if (!latex || !renderedText || !isFullySelectedFormula(range, candidate, renderedText)) continue;
        fragments.push(Object.freeze({
            kind: 'formula' as const,
            renderedText,
            latex,
            isBlock: extracted?.isBlock ?? parser.isBlockMath(candidate),
        }));
    }
    return fragments;
}

function rangeContainsNode(range: Range, node: Node): boolean {
    try {
        const nodeRange = range.cloneRange();
        nodeRange.selectNode(node);
        return range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0
            && range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0;
    } catch {
        return false;
    }
}

function isFullySelectedFormula(range: Range, node: HTMLElement, renderedText: string): boolean {
    if (rangeContainsNode(range, node)) return true;
    try {
        return range.intersectsNode(node)
            && normalizeSurfaceText(range.toString()) === renderedText;
    } catch {
        return false;
    }
}

function getElementForNode(node: Node): HTMLElement | null {
    return node instanceof HTMLElement ? node : node.parentElement;
}
