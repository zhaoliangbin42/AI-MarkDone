import { describe, expect, it } from 'vitest';

import {
    createConversationDocumentKeyV1,
    type ConversationContentSourceV1,
    type ConversationSnapshotV1,
} from '@/contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '@/contracts/conversationMaterialization';
import type { ContentSurfaceSelectionEvidenceV1 } from '@/contracts/contentSurface';
import { projectSurfaceSelectionToMarkdown } from '@/services/semantic-content/SurfaceProjection';

const documentKey = createConversationDocumentKeyV1('chatgpt', 'conversation-1');
const target = {
    documentKey,
    turnId: 'turn-1',
    userMessageId: 'user-1',
    assistantMessageId: 'assistant-1',
} as const;

function createSnapshot(options: Readonly<{
    markdown?: string;
    contentToken?: string;
    authority?: 'primary' | 'host-rendered' | 'reconstructed';
}> = {}): ConversationSnapshotV1 {
    const authority = options.authority ?? 'primary';
    return {
        schemaVersion: 1,
        document: {
            key: documentKey,
            platformId: 'chatgpt',
            conversationId: 'conversation-1',
        },
        contentToken: options.contentToken ?? 'content-token-1',
        coverage: 'complete',
        turns: [{
            key: 'turn-1:assistant-1',
            ordinal: 1,
            identity: {
                turnId: 'turn-1',
                userMessageId: 'user-1',
                assistantMessageId: 'assistant-1',
            },
            userText: 'Question',
            assistantMarkdown: options.markdown ?? 'Before **clean Markdown** after.',
            assistantProvenance: {
                authority,
                fidelity: authority === 'primary'
                    ? 'exact'
                    : authority === 'host-rendered'
                        ? 'normalized'
                        : 'lossy',
                producer: authority === 'primary'
                    ? 'provider-graph'
                    : authority === 'host-rendered'
                        ? 'rendered-content-v2'
                        : 'rendered-dom',
            },
        }],
    };
}

function createSource(snapshot: ConversationSnapshotV1): ConversationContentSourceV1 {
    const state = { kind: 'ready' as const, document: snapshot.document, snapshot };
    return {
        read: () => state,
        subscribe: (listener) => {
            listener(state);
            return () => undefined;
        },
        refresh: async () => state,
        isCurrent: (contentToken) => contentToken === snapshot.contentToken,
    };
}

function createMaterialization(
    snapshot: ConversationSnapshotV1,
    materializationToken = 'materialization-1',
): ConversationMaterializationPortV1 {
    const anchorElement = document.createElement('article');
    const state = {
        materializationToken,
        contentToken: snapshot.contentToken,
        entries: [{ target, anchorElement }],
    };
    return {
        read: () => state,
        subscribe: (listener) => {
            listener(state);
            return () => undefined;
        },
        resolveElement: () => target,
        locate: async () => 'located',
    };
}

function createEvidence(overrides: Partial<ContentSurfaceSelectionEvidenceV1> = {}): ContentSurfaceSelectionEvidenceV1 {
    return {
        target,
        contentToken: 'content-token-1',
        materializationToken: 'materialization-1',
        surfaceToken: 'chatgpt:surface:1',
        selector: {
            kind: 'text-quote',
            exact: 'clean Markdown',
            prefix: 'Before',
            suffix: 'after.',
        },
        ...overrides,
    };
}

describe('projectSurfaceSelectionToMarkdown', () => {
    it('joins surface evidence to the canonical source and preserves Markdown wrappers', () => {
        const snapshot = createSnapshot();

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot),
            evidence: createEvidence(),
        })).toMatchObject({
            status: 'ready',
            markdown: '**clean Markdown**',
            contentToken: snapshot.contentToken,
        });
    });

    it('projects from sealed host-rendered canonical Markdown', () => {
        const snapshot = createSnapshot({ authority: 'host-rendered' });

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot),
            evidence: createEvidence(),
        })).toMatchObject({
            status: 'ready',
            markdown: '**clean Markdown**',
            contentToken: snapshot.contentToken,
        });
    });

    it('rejects stale content and remounted materialization tokens', () => {
        const snapshot = createSnapshot();

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot),
            evidence: createEvidence({ contentToken: 'stale-content' }),
        })).toEqual({ status: 'unavailable', reason: 'stale-content' });

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot, 'materialization-2'),
            evidence: createEvidence(),
        })).toEqual({ status: 'unavailable', reason: 'stale-surface' });
    });

    it('never promotes reconstructed DOM text to canonical Markdown', () => {
        const snapshot = createSnapshot({ authority: 'reconstructed' });

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot),
            evidence: createEvidence(),
        })).toEqual({ status: 'unavailable', reason: 'source-insufficient' });
    });

    it('fails closed when a visible quote maps to more than one source span', () => {
        const snapshot = createSnapshot({ markdown: 'same value and same value' });

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot),
            evidence: createEvidence({
                selector: { kind: 'text-quote', exact: 'same value' },
            }),
        })).toEqual({ status: 'unavailable', reason: 'ambiguous-mapping' });
    });

    it('resolves visual formula text through parser-provided canonical TeX evidence', () => {
        const snapshot = createSnapshot({ markdown: 'Result $\\frac{x}{y}$. ' });

        expect(projectSurfaceSelectionToMarkdown({
            source: createSource(snapshot),
            materialization: createMaterialization(snapshot),
            evidence: createEvidence({
                selector: { kind: 'text-quote', exact: 'x y' },
                atomicFragments: [{
                    kind: 'formula',
                    renderedText: 'x y',
                    latex: '\\frac{x}{y}',
                    isBlock: false,
                }],
            }),
        })).toMatchObject({
            status: 'ready',
            markdown: '$\\frac{x}{y}$',
        });
    });
});
