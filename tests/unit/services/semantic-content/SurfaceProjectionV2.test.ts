import { describe, expect, it } from 'vitest';

import type {
    ConversationDiscoveryPortV2,
    ConversationDiscoverySnapshotV2,
    ConversationTurnReadResultV2,
} from '@/contracts/conversationDiscoveryV2';
import { projectSurfaceSelectionToMarkdownV2 } from '@/services/semantic-content/SurfaceProjection';

function createDiscovery(): ConversationDiscoveryPortV2 {
    const assistant = document.createElement('section');
    assistant.innerHTML = '<div class="markdown prose"><p>Result <span class="katex"><span class="katex-html">x / y</span></span>.</p></div>';
    const ref = Object.freeze({
        documentEpochId: 'epoch-1',
        projectionId: 'projection-1',
        slotKey: 'round-1',
    });
    const turn = Object.freeze({
        schemaVersion: 2 as const,
        key: 'chatgpt:conversation:conversation-1:assistant:assistant-1',
        identity: Object.freeze({
            turnId: 'turn-1',
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
        }),
        user: Object.freeze({ markdown: 'Question', text: 'Question' }),
        assistant: Object.freeze({ markdown: 'Result $x/y$.', text: 'Result x/y.' }),
        turnToken: 'turn-token-1',
        provenance: Object.freeze({
            authority: 'host-rendered' as const,
            fidelity: 'verified-normalized' as const,
            adapterId: 'chatgpt' as const,
            compilerVersion: 'rendered-content-v2' as const,
        }),
    });
    const snapshot: ConversationDiscoverySnapshotV2 = Object.freeze({
        kind: 'ready',
        document: Object.freeze({
            documentEpochId: 'epoch-1',
            projectionId: 'projection-1',
            documentKey: 'chatgpt:conversation:conversation-1',
            platformId: 'chatgpt' as const,
            conversationId: 'conversation-1',
            canonicalUrl: 'https://chatgpt.com/c/conversation-1',
        }),
        revisions: Object.freeze({ topology: 1, content: 1, materialization: 1 }),
        tokens: Object.freeze({
            topologyToken: 'topology-1',
            contentToken: 'content-1',
            materializationToken: 'materialization-1',
        }),
        totalCount: 1,
        readyCount: 1,
        entries: Object.freeze([Object.freeze({
            ref,
            position: 1,
            label: { kind: 'prompt' as const, text: 'Question' },
            identity: turn.identity,
            content: { kind: 'ready' as const, turnToken: turn.turnToken },
            materialization: {
                kind: 'mounted' as const,
                user: null,
                assistant: {
                    role: 'assistant' as const,
                    surfaceToken: 'surface-1',
                    anchorElement: assistant,
                    messageElement: assistant,
                    contentRootElement: assistant.querySelector('.markdown') as HTMLElement,
                },
            },
        })]),
    });
    const readTurn: ConversationTurnReadResultV2 = Object.freeze({
        kind: 'ready',
        ref,
        position: 1,
        turn,
        revision: Object.freeze({
            documentEpochId: 'epoch-1',
            projectionId: 'projection-1',
            topologyToken: 'topology-1',
            contentToken: 'content-1',
            turnToken: turn.turnToken,
        }),
    });
    return {
        read: () => snapshot,
        subscribe: () => () => undefined,
        refresh: async () => snapshot,
        readTurn: () => readTurn,
        resolveElement: () => ref,
        locate: async () => ({
            kind: 'located' as const,
            phase: 'already-mounted' as const,
            ref,
            surfaceToken: 'surface-1',
        }),
    };
}

describe('SurfaceProjection V2', () => {
    it('projects a formula selection from the sealed V2 turn, never from rendered glyph text', () => {
        const result = projectSurfaceSelectionToMarkdownV2({
            discovery: createDiscovery(),
            evidence: {
                ref: {
                    documentEpochId: 'epoch-1',
                    projectionId: 'projection-1',
                    slotKey: 'round-1',
                },
                turnToken: 'turn-token-1',
                surfaceToken: 'surface-1',
                quote: {
                    kind: 'text-quote',
                    exact: 'x / y',
                },
                position: { start: 7, end: 12, unit: 'unicode-code-point' },
                atoms: [{
                    kind: 'formula',
                    latex: 'x/y',
                    renderedText: 'x / y',
                    display: false,
                    occurrence: 1,
                }],
            },
        });

        expect(result).toMatchObject({ status: 'ready', markdown: '$x/y$' });
    });

    it('fails closed when the sealed turn token no longer matches the surface evidence', () => {
        const result = projectSurfaceSelectionToMarkdownV2({
            discovery: createDiscovery(),
            evidence: {
                ref: {
                    documentEpochId: 'epoch-1',
                    projectionId: 'projection-1',
                    slotKey: 'round-1',
                },
                turnToken: 'stale-turn-token',
                surfaceToken: 'surface-1',
                quote: { kind: 'text-quote', exact: 'Result' },
                position: { start: 0, end: 6, unit: 'unicode-code-point' },
                atoms: [],
            },
        });

        expect(result).toEqual({ status: 'unavailable', reason: 'stale-content' });
    });
});
