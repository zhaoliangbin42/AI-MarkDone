import type {
    ContentSurfaceAtomicFragmentV1,
    ContentSurfaceSelectionEvidenceV1,
    ContentSurfaceSelectionEvidenceV2,
} from '../../contracts/contentSurface';
import {
    getConversationTurnSourceQualityV1,
    type ConversationContentSourceV1,
} from '../../contracts/conversationContent';
import type {
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { SemanticContentModuleV1 } from '../../contracts/semanticContent';
import type { ConversationDiscoveryPortV2 } from '../../contracts/conversationDiscoveryV2';
import { semanticContent } from './SemanticContent';
import { emitContentPerformanceEvent } from '../../drivers/content/performanceDiagnostics';

export type SurfaceMarkdownProjectionResult =
    | Readonly<{
        status: 'ready';
        markdown: string;
        contentToken: string;
        semanticRevision: string;
        evidence: ContentSurfaceSelectionEvidenceV1;
    }>
    | Readonly<{
        status: 'unavailable';
        reason:
            | 'source-unavailable'
            | 'stale-content'
            | 'stale-surface'
            | 'target-unresolved'
            | 'source-insufficient'
            | 'ambiguous-mapping';
    }>;

export function projectSurfaceSelectionToMarkdown(options: Readonly<{
    source: ConversationContentSourceV1;
    materialization: ConversationMaterializationPortV1;
    evidence: ContentSurfaceSelectionEvidenceV1;
    semanticModule?: SemanticContentModuleV1;
}>): SurfaceMarkdownProjectionResult {
    const state = options.source.read();
    const snapshot = state.snapshot;
    if (!state.document || !snapshot) return unavailable('source-unavailable');
    if (
        snapshot.contentToken !== options.evidence.contentToken
        || !options.source.isCurrent(options.evidence.contentToken)
    ) return unavailable('stale-content');

    const materialization = options.materialization.read();
    if (materialization.contentToken !== options.evidence.contentToken) {
        return unavailable('stale-content');
    }
    if (materialization.materializationToken !== options.evidence.materializationToken) {
        return unavailable('stale-surface');
    }
    const materializedMatches = materialization.entries.filter(({ target }) => (
        target.turnId === options.evidence.target.turnId
        && target.assistantMessageId === options.evidence.target.assistantMessageId
        && (
            options.evidence.target.userMessageId === undefined
            || target.userMessageId === options.evidence.target.userMessageId
        )
    ));
    if (materializedMatches.length !== 1) return unavailable('target-unresolved');

    const matches = snapshot.turns.filter((turn) => (
        turn.identity.turnId === options.evidence.target.turnId
        && turn.identity.assistantMessageId === options.evidence.target.assistantMessageId
        && (
            options.evidence.target.userMessageId === undefined
            || turn.identity.userMessageId === options.evidence.target.userMessageId
        )
    ));
    let turn = matches.length === 1 ? matches[0]! : null;
    let turnContentToken = snapshot.contentToken;
    if (!turn && matches.length === 0) {
        const readPort = getTurnReadPort(options.source);
        const direct: ConversationTurnReadResultV1 | null = readPort
            ? readPort.readTurn(options.evidence.target)
            : null;
        if (direct?.kind === 'ready') {
            turn = direct.turn;
            turnContentToken = direct.contentToken;
        }
    }
    if (!turn) return unavailable('target-unresolved');
    if (
        getConversationTurnSourceQualityV1(turn) === 'reconstructed'
        || !turn.assistantMarkdown.trim()
    ) {
        return unavailable('source-insufficient', 'turn-source');
    }

    const projected = projectCanonicalSelection({
        key: `${snapshot.document.key}:assistant:${turn.identity.assistantMessageId}`,
        revision: turnContentToken,
        markdown: turn.assistantMarkdown,
        coverage: snapshot.coverage,
        provenance: turn.assistantProvenance ?? {
            authority: 'primary' as const,
            fidelity: 'exact' as const,
            producer: 'conversation-content-v1',
        },
        selector: options.evidence.selector,
        atomicFragments: options.evidence.atomicFragments,
        semanticModule: options.semanticModule,
    });
    if (projected.status !== 'ready') return unavailable(projected.reason, projected.stage);

    return Object.freeze({
        status: 'ready',
        markdown: projected.markdown,
        contentToken: snapshot.contentToken,
        semanticRevision: projected.semanticRevision,
        evidence: options.evidence,
    });
}

export type SurfaceMarkdownProjectionResultV2 =
    | Readonly<{
        status: 'ready';
        markdown: string;
        contentToken: string;
        semanticRevision: string;
        evidence: ContentSurfaceSelectionEvidenceV2;
    }>
    | Readonly<{
        status: 'unavailable';
        reason: Exclude<SurfaceMarkdownProjectionResult, { status: 'ready' }>['reason'];
    }>;

/** Project a browser selection directly through the V2 discovery port. */
export function projectSurfaceSelectionToMarkdownV2(options: Readonly<{
    discovery: ConversationDiscoveryPortV2;
    evidence: ContentSurfaceSelectionEvidenceV2;
    semanticModule?: SemanticContentModuleV1;
}>): SurfaceMarkdownProjectionResultV2 {
    const snapshot = options.discovery.read();
    if (snapshot.kind !== 'ready') return unavailableV2('source-unavailable');
    if (
        options.evidence.ref.documentEpochId !== snapshot.document.documentEpochId
        || options.evidence.ref.projectionId !== snapshot.document.projectionId
    ) return unavailableV2('stale-content');
    const entry = snapshot.entries.find((candidate) => (
        candidate.ref.slotKey === options.evidence.ref.slotKey
        && candidate.ref.documentEpochId === options.evidence.ref.documentEpochId
        && candidate.ref.projectionId === options.evidence.ref.projectionId
    ));
    if (!entry || entry.content.kind !== 'ready') return unavailableV2('target-unresolved');
    const surface = entry.materialization.assistant;
    if (!surface || surface.surfaceToken !== options.evidence.surfaceToken) {
        return unavailableV2('stale-surface');
    }
    const result = options.discovery.readTurn({ kind: 'entry', ref: options.evidence.ref });
    if (result.kind !== 'ready') {
        return unavailableV2(result.reason === 'identity-conflict' ? 'ambiguous-mapping' : 'target-unresolved');
    }
    if (result.turn.turnToken !== options.evidence.turnToken) return unavailableV2('stale-content');
    const projected = projectCanonicalSelection({
        key: result.turn.key,
        revision: result.revision.turnToken,
        markdown: result.turn.assistant.markdown,
        coverage: 'complete',
        provenance: {
            authority: 'primary' as const,
            fidelity: 'exact' as const,
            producer: 'conversation-discovery-v2',
        },
        selector: options.evidence.quote,
        atomicFragments: options.evidence.atoms.map((atom) => ({
            kind: 'formula' as const,
            renderedText: atom.renderedText ?? atom.latex,
            latex: atom.latex,
            isBlock: atom.display,
        })),
        semanticModule: options.semanticModule,
    });
    if (projected.status !== 'ready') return unavailableV2(projected.reason);
    return Object.freeze({
        status: 'ready',
        markdown: projected.markdown,
        contentToken: result.revision.contentToken,
        semanticRevision: projected.semanticRevision,
        evidence: options.evidence,
    });
}

function projectCanonicalSelection(options: Readonly<{
    key: string;
    revision: string;
    markdown: string;
    coverage: 'complete' | 'partial' | 'fragment';
    provenance: Parameters<SemanticContentModuleV1['compile']>[0]['provenance'];
    selector: Parameters<SemanticContentModuleV1['resolve']>[1];
    atomicFragments?: readonly ContentSurfaceAtomicFragmentV1[];
    semanticModule?: SemanticContentModuleV1;
}>):
    | Readonly<{ status: 'ready'; markdown: string; semanticRevision: string }>
    | Readonly<{
        status: 'unavailable';
        reason: Exclude<SurfaceMarkdownProjectionResult, { status: 'ready' }>['reason'];
        stage: string;
    }> {
    const module = options.semanticModule ?? semanticContent;
    const compiled = module.compile({
        key: options.key,
        revision: options.revision,
        mediaType: 'text/markdown',
        syntaxProfile: 'commonmark-gfm-math',
        text: options.markdown,
        coverage: options.coverage,
        provenance: options.provenance,
    });
    if (compiled.status !== 'ready') return { status: 'unavailable', reason: 'source-unavailable', stage: 'compile' };
    const resolved = resolveSurfaceSelection(module, compiled.document, options.selector, options.atomicFragments);
    if (resolved.status !== 'ready') {
        const diagnosticCode = resolved.diagnostics[0]?.code ?? 'unknown';
        return {
            status: 'unavailable',
            reason: resolved.status === 'ambiguous' ? 'ambiguous-mapping' : 'source-insufficient',
            stage: `resolve:${resolved.status}:${diagnosticCode}`,
        };
    }
    const projected = module.project(compiled.document, {
        kind: 'markdown-fragment',
        selection: resolved.selection,
    });
    if (projected.status !== 'ready' || projected.kind !== 'markdown-fragment' || !projected.markdown) {
        return { status: 'unavailable', reason: 'source-insufficient', stage: 'project' };
    }
    return Object.freeze({
        status: 'ready',
        markdown: preserveExactFormulaEnvelope(
            projected.markdown,
            options.selector,
            options.atomicFragments,
        ),
        semanticRevision: compiled.document.revision,
    });
}

function preserveExactFormulaEnvelope(
    markdown: string,
    selector: Parameters<SemanticContentModuleV1['resolve']>[1],
    fragments: readonly ContentSurfaceAtomicFragmentV1[] | undefined,
): string {
    if (fragments?.length !== 1) return markdown;
    const fragment = fragments[0];
    if (fragment?.kind !== 'formula') return markdown;
    const renderedText = fragment.renderedText.trim();
    const latex = fragment.latex.trim();
    if (
        !renderedText
        || !latex
        || selector.exact.trim() !== renderedText
        || markdown.trim() !== latex
    ) return markdown;
    return fragment.isBlock ? `$$\n${latex}\n$$` : `$${latex}$`;
}

function resolveSurfaceSelection(
    module: SemanticContentModuleV1,
    document: Parameters<SemanticContentModuleV1['project']>[0],
    selector: Parameters<SemanticContentModuleV1['resolve']>[1],
    atomicFragments: readonly ContentSurfaceAtomicFragmentV1[] | undefined,
) {
    const direct = module.resolve(document, selector);
    if (direct.status === 'ready' || !atomicFragments?.length) return direct;

    let transformed = selector;
    for (const fragment of atomicFragments) {
        const renderedText = fragment.renderedText.trim();
        const latex = fragment.latex.trim();
        if (!renderedText || !latex) continue;
        transformed = {
            ...transformed,
            exact: replaceOnce(transformed.exact, renderedText, latex),
            ...(transformed.prefix
                ? { prefix: replaceLast(transformed.prefix, renderedText, latex) }
                : {}),
            ...(transformed.suffix
                ? { suffix: replaceOnce(transformed.suffix, renderedText, latex) }
                : {}),
        };
    }
    if (transformed.exact === selector.exact) return direct;
    return module.resolve(document, transformed);
}

function replaceOnce(value: string, search: string, replacement: string): string {
    const index = value.indexOf(search);
    return index < 0 ? value : `${value.slice(0, index)}${replacement}${value.slice(index + search.length)}`;
}

function replaceLast(value: string, search: string, replacement: string): string {
    const index = value.lastIndexOf(search);
    return index < 0 ? value : `${value.slice(0, index)}${replacement}${value.slice(index + search.length)}`;
}

function getTurnReadPort(source: ConversationContentSourceV1): ConversationTurnReadPortV1 | null {
    if (typeof (source as Partial<ConversationTurnReadPortV1>).readTurn !== 'function') return null;
    return source as unknown as ConversationTurnReadPortV1;
}

function unavailable(
    reason: Exclude<SurfaceMarkdownProjectionResult, { status: 'ready' }>['reason'],
    stage?: string,
): SurfaceMarkdownProjectionResult {
    emitContentPerformanceEvent({
        kind: 'markdown-projection-rejection',
        status: 'unavailable',
        reason,
        ...(stage ? { stage } : {}),
    });
    return Object.freeze({ status: 'unavailable', reason });
}

function unavailableV2(reason: Exclude<SurfaceMarkdownProjectionResultV2, { status: 'ready' }>['reason']): SurfaceMarkdownProjectionResultV2 {
    return Object.freeze({ status: 'unavailable', reason });
}
