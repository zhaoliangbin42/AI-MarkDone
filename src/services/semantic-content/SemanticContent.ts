import { unified } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';

import type {
    CanonicalContentSourceV1,
    SemanticCompileOutcomeV1,
    SemanticContentModuleV1,
    SemanticDiagnosticV1,
    SemanticDocumentV1,
    SemanticNodeAttributeV1,
    SemanticNodeKindV1,
    SemanticNodeV1,
    SemanticOutlineItemV1,
    SemanticProjectionOutcomeV1,
    SemanticProjectionRequestV1,
    SemanticReaderUnitKindV1,
    SemanticReaderUnitModeV1,
    SemanticReaderUnitV1,
    SemanticResolveOutcomeV1,
    SemanticSelectionV1,
    SemanticSourceSpanV1,
    SemanticTextQuoteSelectorV1,
} from '../../contracts/semanticContent';

const SEMANTIC_SCHEMA_VERSION = 1;
const MAX_SOURCE_LENGTH = 2_000_000;
const DEFAULT_CACHE_CAPACITY = 64;

type MdastNode = {
    type?: string;
    value?: string;
    alt?: string;
    url?: string;
    title?: string;
    depth?: number;
    ordered?: boolean;
    start?: number | null;
    lang?: string | null;
    meta?: string | null;
    position?: {
        start?: { offset?: number };
        end?: { offset?: number };
    };
    children?: MdastNode[];
};

type MutableSemanticNode = {
    id: string;
    kind: SemanticNodeKindV1;
    span: SemanticSourceSpanV1 | null;
    text?: string;
    attributes: Record<string, SemanticNodeAttributeV1>;
    children: MutableSemanticNode[];
};

type ProjectionNode = {
    nodeId: string;
    sourceStart: number;
    sourceEnd: number;
    textStart: number;
    textEnd: number;
};

type InternalDocument = {
    sourceText: string;
    textSourceStarts: number[];
    textSourceEnds: number[];
    projectionNodes: ProjectionNode[];
    units: readonly SemanticReaderUnitV1[];
    outline: readonly SemanticOutlineItemV1[];
};

type MutableCompileState = {
    source: CanonicalContentSourceV1;
    text: TextIndexBuilder;
    nodeCounter: number;
    unitCounter: number;
    projectionNodes: ProjectionNode[];
    units: Array<SemanticReaderUnitV1 | null>;
    outline: Array<SemanticOutlineItemV1 | null>;
};

class TextIndexBuilder {
    private readonly chars: string[] = [];
    readonly sourceStarts: number[] = [];
    readonly sourceEnds: number[] = [];

    get length(): number {
        return this.chars.length;
    }

    toString(): string {
        return this.chars.join('');
    }

    trimEnd(): void {
        while (this.chars[this.chars.length - 1] === ' ') {
            this.chars.pop();
            this.sourceStarts.pop();
            this.sourceEnds.pop();
        }
    }

    slice(start: number, end: number): string {
        return this.chars.slice(start, end).join('');
    }

    appendGap(sourceText: string, start: number, end: number): void {
        if (end <= start || this.chars.length === 0) return;
        const gap = sourceText.slice(start, end);
        if (!/[\s|]/.test(gap)) return;
        this.appendSpace(start, end);
    }

    appendValue(value: string, sourceText: string, sourceStart: number, sourceEnd: number): void {
        if (!value) return;
        const boundedStart = Math.max(0, Math.min(sourceText.length, sourceStart));
        const boundedEnd = Math.max(boundedStart, Math.min(sourceText.length, sourceEnd));
        const sourceSlice = sourceText.slice(boundedStart, boundedEnd);
        const exactIndex = sourceSlice.indexOf(value);
        const exactStart = exactIndex >= 0 ? boundedStart + exactIndex : -1;

        for (let index = 0; index < value.length; index += 1) {
            const character = value[index]!;
            // If a parser decoded an entity or Markdown escape, proportional
            // offsets would manufacture a plausible but incorrect source
            // span. Keep such characters unresolved; whole-node selections
            // can still use the parser-provided node span safely.
            const mappedStart = exactStart >= 0 ? exactStart + index : -1;
            const mappedEnd = exactStart >= 0 ? exactStart + index + 1 : -1;
            if (/\s/.test(character)) {
                this.appendSpace(mappedStart, mappedEnd);
                continue;
            }
            this.chars.push(character);
            this.sourceStarts.push(mappedStart);
            this.sourceEnds.push(mappedEnd);
        }
    }

    appendSpace(sourceStart: number, sourceEnd: number): void {
        if (this.chars.length === 0) return;
        if (this.chars[this.chars.length - 1] === ' ') return;
        this.chars.push(' ');
        this.sourceStarts.push(sourceStart);
        this.sourceEnds.push(sourceStart >= 0 && sourceEnd > sourceStart ? sourceEnd : -1);
    }
}

export class SemanticContent implements SemanticContentModuleV1 {
    private readonly cache = new Map<string, SemanticDocumentV1>();
    private readonly internals = new WeakMap<SemanticDocumentV1, InternalDocument>();

    constructor(private readonly cacheCapacity = DEFAULT_CACHE_CAPACITY) {}

    compile(source: CanonicalContentSourceV1): SemanticCompileOutcomeV1 {
        const validation = validateSource(source);
        if (validation) return rejectedCompile(validation);

        const fingerprint = createFingerprint(source.text);
        const cacheKey = JSON.stringify([
            SEMANTIC_SCHEMA_VERSION,
            source.syntaxProfile,
            source.key,
            source.revision,
            source.coverage,
            source.provenance.authority,
            source.provenance.fidelity,
            source.provenance.producer,
            fingerprint,
        ]);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.cache.delete(cacheKey);
            this.cache.set(cacheKey, cached);
            return Object.freeze({ status: 'ready', document: cached });
        }

        try {
            const tree = unified()
                .use(remarkParse)
                .use(remarkGfm)
                .use(remarkMath)
                .parse(source.text) as MdastNode;
            const frozenSource = freezeSource(source);
            const state: MutableCompileState = {
                source: frozenSource,
                text: new TextIndexBuilder(),
                nodeCounter: 0,
                unitCounter: 0,
                projectionNodes: [],
                units: [],
                outline: [],
            };
            const root = compileNode(tree, state);
            state.text.trimEnd();
            const normalizedTextLength = state.text.length;
            state.projectionNodes = state.projectionNodes
                .map((node) => ({ ...node, textEnd: Math.min(node.textEnd, normalizedTextLength) }))
                .filter((node) => node.textEnd > node.textStart);
            const nodes = Object.freeze(root.children.map((node) => freezeNode(node)));
            const diagnostics = Object.freeze([]) as readonly SemanticDiagnosticV1[];
            const document: SemanticDocumentV1 = Object.freeze({
                schemaVersion: 1,
                key: frozenSource.key,
                revision: frozenSource.revision,
                fingerprint,
                source: frozenSource,
                nodes,
                plainText: state.text.toString(),
                diagnostics,
            });
            const units = Object.freeze(state.units.filter((unit): unit is SemanticReaderUnitV1 => unit !== null));
            const outline = Object.freeze(state.outline.filter((item): item is SemanticOutlineItemV1 => item !== null));
            this.internals.set(document, {
                sourceText: frozenSource.text,
                textSourceStarts: state.text.sourceStarts,
                textSourceEnds: state.text.sourceEnds,
                projectionNodes: state.projectionNodes,
                units,
                outline,
            });
            this.cache.set(cacheKey, document);
            this.evictOverflow();
            return Object.freeze({ status: 'ready', document });
        } catch (error) {
            return rejectedCompile(createDiagnostic(
                'SEMANTIC_PARSE_FAILED',
                'compile',
                error instanceof Error ? error.message : 'Markdown parsing failed.',
            ));
        }
    }

    resolve(
        document: SemanticDocumentV1,
        selector: SemanticTextQuoteSelectorV1,
    ): SemanticResolveOutcomeV1 {
        const internal = this.internals.get(document);
        if (!internal || document.revision !== document.source.revision) {
            return resolutionFailure('rejected', 'SEMANTIC_DOCUMENT_UNKNOWN', 'The semantic document is not owned by this Module.');
        }
        const exact = normalizeQuote(selector.exact);
        if (!exact) {
            return resolutionFailure('unsupported', 'SEMANTIC_QUOTE_EMPTY', 'The text quote is empty.');
        }

        const text = normalizeQuote(document.plainText);
        const candidates = findOccurrences(text, exact);
        if (candidates.length === 0) {
            return resolutionFailure('unsupported', 'SEMANTIC_QUOTE_NOT_FOUND', 'The text quote does not occur in this source revision.');
        }
        const selectedStart = selectCandidate(text, exact, candidates, selector);
        if (selectedStart === null) {
            return resolutionFailure('ambiguous', 'SEMANTIC_QUOTE_AMBIGUOUS', 'The text quote matches more than one source range.');
        }
        const selectedEnd = selectedStart + exact.length;
        const exactNodes = internal.projectionNodes.filter((node) => (
            node.textStart === selectedStart
            && node.textEnd === selectedEnd
        ));
        const widest = exactNodes.reduce<ProjectionNode | null>((current, candidate) => {
            if (!current) return candidate;
            return candidate.sourceEnd - candidate.sourceStart > current.sourceEnd - current.sourceStart
                ? candidate
                : current;
        }, null);
        const startOffset = internal.textSourceStarts[selectedStart];
        const endOffset = internal.textSourceEnds[selectedEnd - 1];
        if (
            !widest
            && (
                !Number.isInteger(startOffset)
                || !Number.isInteger(endOffset)
                || startOffset! < 0
                || endOffset! <= startOffset!
            )
        ) {
            return resolutionFailure('rejected', 'SEMANTIC_SOURCE_MAP_UNPROVEN', 'The text quote cannot be mapped to a proven source span.');
        }
        const span = freezeSpan(document.revision, widest?.sourceStart ?? startOffset!, widest?.sourceEnd ?? endOffset!);
        const selection: SemanticSelectionV1 = Object.freeze({
            documentKey: document.key,
            revision: document.revision,
            spans: Object.freeze([span]),
            nodeIds: Object.freeze(exactNodes.map((node) => node.nodeId)),
            quote: Object.freeze({ ...selector, exact }),
        });
        return Object.freeze({ status: 'ready', selection });
    }

    project(
        document: SemanticDocumentV1,
        request: SemanticProjectionRequestV1,
    ): SemanticProjectionOutcomeV1 {
        const internal = this.internals.get(document);
        if (!internal) {
            return projectionFailure(request.kind, 'SEMANTIC_DOCUMENT_UNKNOWN', 'The semantic document is not owned by this Module.');
        }
        if (request.kind === 'canonical-markdown') {
            const span = freezeSpan(document.revision, 0, internal.sourceText.length);
            return Object.freeze({
                status: 'ready',
                kind: request.kind,
                revision: document.revision,
                markdown: internal.sourceText,
                spans: Object.freeze([span]),
                diagnostics: document.diagnostics,
            });
        }
        if (request.kind === 'plain-text') {
            return Object.freeze({
                status: 'ready',
                kind: request.kind,
                revision: document.revision,
                text: document.plainText,
                diagnostics: document.diagnostics,
            });
        }
        if (request.kind === 'reader-structure') {
            return Object.freeze({
                status: 'ready',
                kind: request.kind,
                revision: document.revision,
                units: internal.units,
                outline: internal.outline,
                diagnostics: document.diagnostics,
            });
        }

        const selection = request.selection;
        if (
            selection.documentKey !== document.key
            || selection.revision !== document.revision
            || selection.spans.length !== 1
        ) {
            return projectionFailure(request.kind, 'SEMANTIC_SELECTION_STALE', 'The selection does not belong to this source revision.');
        }
        const span = selection.spans[0]!;
        if (!isValidSpan(span, document.revision, internal.sourceText.length)) {
            return projectionFailure(request.kind, 'SEMANTIC_SELECTION_INVALID', 'The selection source span is invalid.');
        }
        return Object.freeze({
            status: 'ready',
            kind: request.kind,
            revision: document.revision,
            markdown: internal.sourceText.slice(span.start, span.end),
            spans: selection.spans,
            diagnostics: document.diagnostics,
        });
    }

    private evictOverflow(): void {
        while (this.cache.size > Math.max(1, this.cacheCapacity)) {
            const oldestKey = this.cache.keys().next().value as string | undefined;
            if (!oldestKey) return;
            this.cache.delete(oldestKey);
        }
    }
}

export function createCanonicalMarkdownSource(
    text: string,
    options: Readonly<{
        key?: string;
        revision?: string;
        coverage?: CanonicalContentSourceV1['coverage'];
        producer?: string;
    }> = {},
): CanonicalContentSourceV1 {
    const fingerprint = createFingerprint(text);
    return Object.freeze({
        key: options.key ?? `markdown:${fingerprint}`,
        revision: options.revision ?? fingerprint,
        mediaType: 'text/markdown',
        syntaxProfile: 'commonmark-gfm-math',
        text,
        coverage: options.coverage ?? 'complete',
        provenance: Object.freeze({
            authority: 'primary',
            fidelity: 'exact',
            producer: options.producer ?? 'ai-markdone-markdown',
        }),
    });
}

function compileNode(node: MdastNode, state: MutableCompileState): MutableSemanticNode {
    const nodeId = `aimd-semantic-node-${++state.nodeCounter}`;
    const kind = mapNodeKind(node.type);
    const span = readSpan(node, state.source.revision, state.source.text.length);
    const textStart = state.text.length;
    const readerUnit = mapReaderUnit(node.type);
    const unitSlot = readerUnit ? state.units.push(null) - 1 : -1;
    const outlineSlot = node.type === 'heading' ? state.outline.push(null) - 1 : -1;
    const children: MutableSemanticNode[] = [];

    if (isLiteralSemanticNode(node.type)) {
        appendLiteralNode(node, span, state);
    } else if (node.type === 'break') {
        state.text.appendGap(state.source.text, span?.start ?? 0, span?.end ?? 0);
    } else {
        let previousEnd: number | null = null;
        for (const child of node.children ?? []) {
            const childSpan = readSpan(child, state.source.revision, state.source.text.length);
            if (previousEnd !== null && childSpan) {
                state.text.appendGap(state.source.text, previousEnd, childSpan.start);
            }
            children.push(compileNode(child, state));
            if (childSpan) previousEnd = childSpan.end;
        }
    }

    const textEnd = state.text.length;
    const semanticNode: MutableSemanticNode = {
        id: nodeId,
        kind,
        span,
        ...(readNodeText(node) ? { text: readNodeText(node) } : {}),
        attributes: readNodeAttributes(node, state.source),
        children,
    };
    if (span && textEnd > textStart) {
        state.projectionNodes.push({
            nodeId,
            sourceStart: span.start,
            sourceEnd: span.end,
            textStart,
            textEnd,
        });
    }
    if (readerUnit && span && unitSlot >= 0) {
        const id = `aimd-reader-unit-${++state.unitCounter}`;
        state.units[unitSlot] = Object.freeze({
            id,
            kind: readerUnit.kind,
            mode: readerUnit.mode,
            start: span.start,
            end: span.end,
            source: state.source.text.slice(span.start, span.end),
        });
        if (outlineSlot >= 0) {
            const text = normalizeQuote(state.text.slice(textStart, textEnd));
            if (text) {
                state.outline[outlineSlot] = Object.freeze({
                    id,
                    level: Math.max(1, Math.min(6, Math.round(node.depth ?? 1))),
                    text,
                    start: span.start,
                    end: span.end,
                });
            }
        }
    }
    return semanticNode;
}

function appendLiteralNode(
    node: MdastNode,
    span: SemanticSourceSpanV1 | null,
    state: MutableCompileState,
): void {
    if (!span) return;
    let value = readNodeText(node);
    if (node.type === 'html') value = value.replace(/<[^>]*>/g, ' ');
    state.text.appendValue(value, state.source.text, span.start, span.end);
}

function readNodeText(node: MdastNode): string {
    if (node.type === 'image' || node.type === 'imageReference') return node.alt ?? '';
    return node.value ?? '';
}

function isLiteralSemanticNode(type: string | undefined): boolean {
    return type === 'text'
        || type === 'inlineCode'
        || type === 'code'
        || type === 'inlineMath'
        || type === 'math'
        || type === 'image'
        || type === 'imageReference'
        || type === 'html';
}

function mapNodeKind(type: string | undefined): SemanticNodeKindV1 {
    switch (type) {
        case 'root': return 'document';
        case 'paragraph': return 'paragraph';
        case 'heading': return 'heading';
        case 'blockquote': return 'blockquote';
        case 'list': return 'list';
        case 'listItem': return 'list-item';
        case 'text': return 'text';
        case 'emphasis': return 'emphasis';
        case 'strong': return 'strong';
        case 'delete': return 'deletion';
        case 'link':
        case 'linkReference': return 'link';
        case 'break': return 'break';
        case 'inlineCode': return 'inline-code';
        case 'code': return 'code-block';
        case 'inlineMath': return 'inline-formula';
        case 'math': return 'display-formula';
        case 'table': return 'table';
        case 'tableRow': return 'table-row';
        case 'tableCell': return 'table-cell';
        case 'image':
        case 'imageReference': return 'image';
        case 'thematicBreak': return 'thematic-break';
        default: return 'extension';
    }
}

function mapReaderUnit(type: string | undefined): {
    kind: SemanticReaderUnitKindV1;
    mode: SemanticReaderUnitModeV1;
} | null {
    switch (type) {
        case 'inlineMath': return { kind: 'inline-math', mode: 'atomic' };
        case 'math': return { kind: 'display-math', mode: 'atomic' };
        case 'inlineCode': return { kind: 'inline-code', mode: 'atomic' };
        case 'code': return { kind: 'code-block', mode: 'atomic' };
        case 'table': return { kind: 'table', mode: 'atomic' };
        case 'image':
        case 'imageReference': return { kind: 'image', mode: 'atomic' };
        case 'heading': return { kind: 'heading', mode: 'structural' };
        case 'listItem': return { kind: 'list-item', mode: 'structural' };
        case 'blockquote': return { kind: 'blockquote', mode: 'structural' };
        case 'thematicBreak': return { kind: 'thematic-break', mode: 'structural' };
        default: return null;
    }
}

function readNodeAttributes(
    node: MdastNode,
    source: CanonicalContentSourceV1,
): Record<string, SemanticNodeAttributeV1> {
    const attributes: Record<string, SemanticNodeAttributeV1> = {};
    if (node.type === 'heading') attributes.level = Math.max(1, Math.min(6, Math.round(node.depth ?? 1)));
    if (node.type === 'list') {
        attributes.ordered = Boolean(node.ordered);
        if (typeof node.start === 'number') attributes.start = node.start;
    }
    if (node.type === 'link' || node.type === 'image') {
        if (node.url) attributes.url = node.url;
        if (node.title) attributes.title = node.title;
    }
    if (node.type === 'image' && node.alt) attributes.alt = node.alt;
    if (node.type === 'code') {
        if (node.lang) attributes.language = node.lang;
        if (node.meta) attributes.meta = node.meta;
    }
    if (node.type === 'inlineMath' || node.type === 'math') {
        attributes.tex = node.value ?? '';
        attributes.display = node.type === 'math';
        attributes.authority = source.provenance.authority;
        attributes.fidelity = source.provenance.fidelity;
    }
    if (!knownNodeType(node.type) && node.type) attributes.extensionType = node.type;
    return attributes;
}

function knownNodeType(type: string | undefined): boolean {
    return type !== undefined && mapNodeKind(type) !== 'extension';
}

function readSpan(
    node: MdastNode,
    revision: string,
    sourceLength: number,
): SemanticSourceSpanV1 | null {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (
        !Number.isInteger(start)
        || !Number.isInteger(end)
        || start! < 0
        || end! < start!
        || end! > sourceLength
    ) return null;
    return freezeSpan(revision, start!, end!);
}

function freezeNode(node: MutableSemanticNode): SemanticNodeV1 {
    return Object.freeze({
        ...node,
        span: node.span ? Object.freeze({ ...node.span }) : null,
        attributes: Object.freeze({ ...node.attributes }),
        children: Object.freeze(node.children.map((child) => freezeNode(child))),
    });
}

function freezeSource(source: CanonicalContentSourceV1): CanonicalContentSourceV1 {
    return Object.freeze({
        ...source,
        provenance: Object.freeze({ ...source.provenance }),
    });
}

function freezeSpan(revision: string, start: number, end: number): SemanticSourceSpanV1 {
    return Object.freeze({ revision, start, end });
}

function validateSource(source: CanonicalContentSourceV1): SemanticDiagnosticV1 | null {
    if (!source.key.trim() || !source.revision.trim() || !source.provenance.producer.trim()) {
        return createDiagnostic('SEMANTIC_SOURCE_IDENTITY_INVALID', 'compile', 'Canonical source identity is incomplete.');
    }
    if (source.mediaType !== 'text/markdown' || source.syntaxProfile !== 'commonmark-gfm-math') {
        return createDiagnostic('SEMANTIC_SOURCE_UNSUPPORTED', 'compile', 'Canonical source media type or syntax profile is unsupported.');
    }
    if (source.text.length > MAX_SOURCE_LENGTH) {
        return createDiagnostic('SEMANTIC_SOURCE_TOO_LARGE', 'compile', 'Canonical source exceeds the semantic parsing budget.');
    }
    return null;
}

function rejectedCompile(diagnostic: SemanticDiagnosticV1): SemanticCompileOutcomeV1 {
    return Object.freeze({ status: 'rejected', diagnostics: Object.freeze([diagnostic]) });
}

function resolutionFailure(
    status: 'ambiguous' | 'unsupported' | 'rejected',
    code: string,
    message: string,
): SemanticResolveOutcomeV1 {
    return Object.freeze({
        status,
        diagnostics: Object.freeze([createDiagnostic(code, 'resolve', message)]),
    });
}

function projectionFailure(
    kind: SemanticProjectionRequestV1['kind'],
    code: string,
    message: string,
): SemanticProjectionOutcomeV1 {
    return Object.freeze({
        status: 'rejected',
        kind,
        diagnostics: Object.freeze([createDiagnostic(code, 'project', message)]),
    });
}

function createDiagnostic(
    code: string,
    phase: SemanticDiagnosticV1['phase'],
    message: string,
): SemanticDiagnosticV1 {
    return Object.freeze({ code, phase, severity: 'error', message });
}

function normalizeQuote(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function findOccurrences(text: string, exact: string): number[] {
    const occurrences: number[] = [];
    let cursor = 0;
    while (cursor <= text.length - exact.length) {
        const index = text.indexOf(exact, cursor);
        if (index < 0) break;
        occurrences.push(index);
        cursor = index + Math.max(1, exact.length);
    }
    return occurrences;
}

function selectCandidate(
    text: string,
    exact: string,
    candidates: number[],
    selector: SemanticTextQuoteSelectorV1,
): number | null {
    if (candidates.length === 1) return candidates[0]!;
    const prefix = normalizeQuote(selector.prefix ?? '').slice(-96);
    const suffix = normalizeQuote(selector.suffix ?? '').slice(0, 96);
    if (!prefix && !suffix) return null;
    const scored = candidates.map((start) => ({
        start,
        // Surface quote contexts intentionally omit boundary whitespace. Score
        // against normalized text on each side instead of a fixed raw window,
        // otherwise the separator before the selection shifts the window and
        // makes a unique quote look ambiguous.
        score: commonSuffixLength(normalizeQuote(text.slice(0, start)), prefix)
            + commonPrefixLength(normalizeQuote(text.slice(start + exact.length)), suffix),
    })).sort((left, right) => right.score - left.score);
    const best = scored[0];
    if (!best || best.score <= 0 || best.score === scored[1]?.score) return null;
    return best.start;
}

function commonPrefixLength(left: string, right: string): number {
    let length = 0;
    while (length < left.length && length < right.length && left[length] === right[length]) length += 1;
    return length;
}

function commonSuffixLength(left: string, right: string): number {
    let length = 0;
    while (
        length < left.length
        && length < right.length
        && left[left.length - length - 1] === right[right.length - length - 1]
    ) length += 1;
    return length;
}

function isValidSpan(span: SemanticSourceSpanV1, revision: string, sourceLength: number): boolean {
    return span.revision === revision
        && Number.isInteger(span.start)
        && Number.isInteger(span.end)
        && span.start >= 0
        && span.end >= span.start
        && span.end <= sourceLength;
}

function createFingerprint(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `semantic-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const semanticContent: SemanticContentModuleV1 = new SemanticContent();
