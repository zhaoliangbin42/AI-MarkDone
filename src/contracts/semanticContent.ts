/**
 * Provider-neutral semantic content contract.
 *
 * The contract owns source identity, immutable semantic structure, source
 * spans, selection resolution, and pure projections. DOM nodes, browser
 * ranges, platform ids, clipboard APIs, and renderer implementation types are
 * deliberately excluded.
 */

export type SemanticContentAuthorityV1 =
    | 'primary'
    | 'verified-derived'
    | 'host-rendered'
    | 'reconstructed'
    | 'rendered-only';

export type SemanticContentFidelityV1 = 'exact' | 'normalized' | 'lossy' | 'unknown';

export type SemanticContentProvenanceV1 = Readonly<{
    authority: SemanticContentAuthorityV1;
    fidelity: SemanticContentFidelityV1;
    producer: string;
}>;

export type CanonicalContentSourceV1 = Readonly<{
    key: string;
    revision: string;
    mediaType: 'text/markdown';
    syntaxProfile: 'commonmark-gfm-math';
    text: string;
    coverage: 'complete' | 'partial' | 'fragment';
    provenance: SemanticContentProvenanceV1;
}>;

export type SemanticSourceSpanV1 = Readonly<{
    revision: string;
    /** UTF-16 code-unit offset, inclusive. */
    start: number;
    /** UTF-16 code-unit offset, exclusive. */
    end: number;
}>;

export type SemanticNodeKindV1 =
    | 'document'
    | 'paragraph'
    | 'heading'
    | 'blockquote'
    | 'list'
    | 'list-item'
    | 'text'
    | 'emphasis'
    | 'strong'
    | 'deletion'
    | 'link'
    | 'break'
    | 'inline-code'
    | 'code-block'
    | 'inline-formula'
    | 'display-formula'
    | 'table'
    | 'table-row'
    | 'table-cell'
    | 'image'
    | 'thematic-break'
    | 'extension';

export type SemanticNodeAttributeV1 = string | number | boolean;

export type SemanticNodeV1 = Readonly<{
    id: string;
    kind: SemanticNodeKindV1;
    span: SemanticSourceSpanV1 | null;
    text?: string;
    attributes: Readonly<Record<string, SemanticNodeAttributeV1>>;
    children: readonly SemanticNodeV1[];
}>;

export type SemanticReaderUnitKindV1 =
    | 'inline-math'
    | 'display-math'
    | 'inline-code'
    | 'code-block'
    | 'table'
    | 'image'
    | 'heading'
    | 'list-item'
    | 'blockquote'
    | 'thematic-break';

export type SemanticReaderUnitModeV1 = 'atomic' | 'structural';

export type SemanticReaderUnitV1 = Readonly<{
    id: string;
    kind: SemanticReaderUnitKindV1;
    mode: SemanticReaderUnitModeV1;
    start: number;
    end: number;
    source: string;
}>;

export type SemanticOutlineItemV1 = Readonly<{
    id: string;
    level: number;
    text: string;
    start: number;
    end: number;
}>;

export type SemanticDiagnosticV1 = Readonly<{
    code: string;
    phase: 'compile' | 'resolve' | 'project';
    severity: 'warning' | 'error';
    message: string;
    span?: SemanticSourceSpanV1;
}>;

export type SemanticDocumentV1 = Readonly<{
    schemaVersion: 1;
    key: string;
    revision: string;
    fingerprint: string;
    source: CanonicalContentSourceV1;
    nodes: readonly SemanticNodeV1[];
    plainText: string;
    diagnostics: readonly SemanticDiagnosticV1[];
}>;

export type SemanticTextQuoteSelectorV1 = Readonly<{
    kind: 'text-quote';
    exact: string;
    prefix?: string;
    suffix?: string;
}>;

export type SemanticSelectionV1 = Readonly<{
    documentKey: string;
    revision: string;
    spans: readonly SemanticSourceSpanV1[];
    nodeIds: readonly string[];
    quote: SemanticTextQuoteSelectorV1;
}>;

export type SemanticCompileOutcomeV1 =
    | Readonly<{ status: 'ready'; document: SemanticDocumentV1 }>
    | Readonly<{ status: 'rejected'; diagnostics: readonly SemanticDiagnosticV1[] }>;

export type SemanticResolveOutcomeV1 =
    | Readonly<{ status: 'ready'; selection: SemanticSelectionV1 }>
    | Readonly<{ status: 'ambiguous' | 'unsupported' | 'rejected'; diagnostics: readonly SemanticDiagnosticV1[] }>;

export type SemanticProjectionRequestV1 =
    | Readonly<{ kind: 'canonical-markdown' }>
    | Readonly<{ kind: 'markdown-fragment'; selection: SemanticSelectionV1 }>
    | Readonly<{ kind: 'plain-text' }>
    | Readonly<{ kind: 'reader-structure' }>;

export type SemanticProjectionOutcomeV1 =
    | Readonly<{
        status: 'ready';
        kind: 'canonical-markdown' | 'markdown-fragment';
        revision: string;
        markdown: string;
        spans: readonly SemanticSourceSpanV1[];
        diagnostics: readonly SemanticDiagnosticV1[];
    }>
    | Readonly<{
        status: 'ready';
        kind: 'plain-text';
        revision: string;
        text: string;
        diagnostics: readonly SemanticDiagnosticV1[];
    }>
    | Readonly<{
        status: 'ready';
        kind: 'reader-structure';
        revision: string;
        units: readonly SemanticReaderUnitV1[];
        outline: readonly SemanticOutlineItemV1[];
        diagnostics: readonly SemanticDiagnosticV1[];
    }>
    | Readonly<{
        status: 'unsupported' | 'rejected';
        kind: SemanticProjectionRequestV1['kind'];
        diagnostics: readonly SemanticDiagnosticV1[];
    }>;

export interface SemanticContentModuleV1 {
    compile(source: CanonicalContentSourceV1): SemanticCompileOutcomeV1;
    resolve(
        document: SemanticDocumentV1,
        selector: SemanticTextQuoteSelectorV1,
    ): SemanticResolveOutcomeV1;
    project(
        document: SemanticDocumentV1,
        request: SemanticProjectionRequestV1,
    ): SemanticProjectionOutcomeV1;
}
