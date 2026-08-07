import type { ConversationContentTokenV1 } from './conversationContent';
import type { ConversationTargetV1 } from './conversationMaterialization';
import type { ConversationEntryRefV2 } from './conversationDiscoveryV2';
import type { SemanticTextQuoteSelectorV1 } from './semanticContent';

/**
 * Immutable, platform-neutral evidence captured from a rendered content
 * surface. DOM nodes and Range coordinates stay inside the driver Adapter.
 */
export type ContentSurfaceSelectionEvidenceV1 = Readonly<{
    target: ConversationTargetV1;
    contentToken: ConversationContentTokenV1;
    materializationToken: string;
    surfaceToken: string;
    selector: SemanticTextQuoteSelectorV1;
    /**
     * Source-bearing atoms captured by the platform parser Adapter. Visual
     * formula text is not authoritative and may not occur in canonical
     * Markdown, so the semantic projection may use these atoms to resolve a
     * proven source span.
     */
    atomicFragments?: readonly ContentSurfaceAtomicFragmentV1[];
}>;

export type ContentSurfaceAtomicFragmentV1 = Readonly<{
    kind: 'formula';
    renderedText: string;
    latex: string;
    isBlock: boolean;
}>;

/**
 * Content-runtime-only selection evidence for the V2 discovery seam.
 *
 * The quote and rendered offsets are evidence, not canonical content.  The
 * V2 projector must still resolve them against the sealed turn identified by
 * `ref` and `turnToken` before it can produce Markdown.
 */
export type ContentSurfaceSelectionEvidenceV2 = Readonly<{
    ref: ConversationEntryRefV2;
    turnToken: string;
    surfaceToken: string;
    quote: SemanticTextQuoteSelectorV1;
    position: Readonly<{
        start: number;
        end: number;
        unit: 'unicode-code-point';
    }>;
    atoms: readonly Readonly<{
        kind: 'formula';
        latex: string;
        /** Rendered quote used only to prove the visual-to-source mapping. */
        renderedText?: string;
        display: boolean;
        occurrence: number;
    }>[];
}>;
