import { describe, expect, it } from 'vitest';
import type {
    ConversationHostSessionV2,
    ConversationSealedTurnV2,
    HostEvidenceBatchV2,
    HostRoleSurfaceV2,
    HostRoundSlotV2,
    RenderedContentCompilerV2,
    RenderedTurnCompileResultV2,
    VirtualConversationHostAdapterV2,
} from '@/contracts/conversationDiscoveryV2';
import { ConversationDiscoveryModuleV2 } from '@/services/content/ConversationDiscoveryModuleV2';

function createRounds(epochId: string, count: number): HostRoundSlotV2[] {
    return Array.from({ length: count }, (_, index) => {
        const userSlotKey = `user-${index + 1}`;
        const assistantSlotKey = `assistant-${index + 1}`;
        return Object.freeze({
            entry: Object.freeze({ epochId, slotKey: `round-${index + 1}` }),
            ordinal: index + 1,
            userSlotKey,
            assistantSlotKey,
            estimatedHeightPx: Object.freeze({ user: 100, assistant: 200 }),
        });
    });
}

function createCompiler(): RenderedContentCompilerV2 {
    return {
        compile: async (request): Promise<RenderedTurnCompileResultV2> => ({
            kind: 'ready',
            user: Object.freeze({ markdown: `User ${request.identity.userMessageId}`, text: `User ${request.identity.userMessageId}` }),
            assistant: Object.freeze({ markdown: `Answer ${request.identity.assistantMessageId}`, text: `Answer ${request.identity.assistantMessageId}` }),
            semanticDigest: `semantic:${request.identity.assistantMessageId}`,
            surfaceDigest: `surface:${request.assistantSurfaceToken}`,
            manifest: Object.freeze({ nodeCount: 2, formulaCount: 0, codeBlockCount: 0, tableCount: 0, imageCount: 0 }),
        }),
    };
}

function createHarness(count = 4) {
    const epochId = 'epoch-1';
    const rounds = createRounds(epochId, count);
    let callback: ((batch: HostEvidenceBatchV2) => void) | null = null;
    let batchId = 0;
    const mountedElements = new Map<string, HTMLElement>();
    const batch = (facts: HostEvidenceBatchV2['facts']): HostEvidenceBatchV2 => ({
        epochId,
        hostRevision: ++batchId,
        batchId: `batch-${batchId}`,
        facts,
    });
    const session: ConversationHostSessionV2 = {
        initial: batch([{
            kind: 'topology-replaced',
            topologyToken: 'topology:1',
            leadingUnpairedSlots: 0,
            trailingUnpairedSlots: 0,
            rounds,
        }]),
        snapshot: () => batch([]),
        resolveElement: () => null,
        scrollSlotIntoView: (entry) => {
            const round = rounds.find((candidate) => candidate.entry.slotKey === entry.slotKey);
            if (!round || !callback) return false;
            emitMount(round);
            return true;
        },
        dispose: () => undefined,
    };
    const host: VirtualConversationHostAdapterV2 = {
        platformId: 'chatgpt',
        resolveDocument: () => ({
            documentKey: 'chatgpt:conversation:conversation-1',
            conversationId: 'conversation-1',
            canonicalUrl: 'https://chatgpt.com/c/conversation-1',
        }),
        start: (params) => {
            callback = params.onEvidence;
            return session;
        },
    };

    function emitMount(round: HostRoundSlotV2, assistantMessageId = `assistant-${round.ordinal}`): void {
        const userMarker = document.createElement('div');
        const assistantMarker = document.createElement('div');
        const userMessage = document.createElement('section');
        const assistantMessage = document.createElement('section');
        userMarker.appendChild(userMessage);
        assistantMarker.appendChild(assistantMessage);
        document.body.append(userMarker, assistantMarker);
        mountedElements.set(round.entry.slotKey, userMarker);
        const createSurface = (
            role: 'user' | 'assistant',
            marker: HTMLElement,
            message: HTMLElement,
            messageId: string,
        ): HostRoleSurfaceV2 => Object.freeze({
            entry: round.entry,
            role,
            lifecycle: 'stable',
            turnId: `turn-${round.ordinal}`,
            messageId,
            surfaceToken: `${round.entry.slotKey}:${role}:${assistantMessageId}`,
            anchorElement: marker,
            messageElement: message,
            contentRootElement: message,
        });
        dispatch([
            { kind: 'role-mounted', surface: createSurface('user', userMarker, userMessage, `user-${round.ordinal}`) },
            { kind: 'role-mounted', surface: createSurface('assistant', assistantMarker, assistantMessage, assistantMessageId) },
        ]);
    }

    function emitUnmount(round: HostRoundSlotV2): void {
        const marker = mountedElements.get(round.entry.slotKey);
        if (marker) marker.remove();
        dispatch([
            { kind: 'role-unmounted', entry: round.entry, role: 'user', surfaceToken: `${round.entry.slotKey}:user:assistant-${round.ordinal}` },
            { kind: 'role-unmounted', entry: round.entry, role: 'assistant', surfaceToken: `${round.entry.slotKey}:assistant:assistant-${round.ordinal}` },
        ]);
    }

    function dispatch(facts: HostEvidenceBatchV2['facts']): HostEvidenceBatchV2 {
        const next = batch(facts);
        callback?.(next);
        return next;
    }

    function replay(next: HostEvidenceBatchV2): void {
        callback?.(next);
    }

    return { epochId, rounds, host, emitMount, emitUnmount, dispatch, replay, createCompiler };
}

describe('ConversationDiscoveryModuleV2', () => {
    it('publishes full shell topology while exposing only sealed hydrated turns', async () => {
        const harness = createHarness(18);
        const module = new ConversationDiscoveryModuleV2({
            host: harness.host,
            compiler: harness.createCompiler(),
            parser: {
                isFormula: () => false,
                readFormula: () => null,
                isCodeBlock: () => false,
                readCodeBlock: () => null,
            },
            createEpochId: () => harness.epochId,
        });
        module.init();

        expect(module.read()).toMatchObject({ kind: 'ready', totalCount: 18, readyCount: 0 });
        const shellRef = module.read().kind === 'ready' ? module.read().entries[2]!.ref : null;
        expect(shellRef).not.toBeNull();

        harness.emitMount(harness.rounds[2]!);
        await Promise.resolve();
        const hydrated = module.read();
        expect(hydrated).toMatchObject({ kind: 'ready', totalCount: 18, readyCount: 1 });
        const target = module.readTurn({ kind: 'entry', ref: shellRef! });
        expect(target.kind).toBe('ready');
        if (target.kind === 'ready') {
            expect(target.position).toBe(3);
            expect(target.turn.assistant.markdown).toBe('Answer assistant-3');
        }

        harness.emitUnmount(harness.rounds[2]!);
        expect(module.readTurn({ kind: 'entry', ref: shellRef! }).kind).toBe('ready');
        module.dispose();
    });

    it('locates a shell by one coarse host call and then precise hydration alignment', async () => {
        const harness = createHarness(4);
        const module = new ConversationDiscoveryModuleV2({
            host: harness.host,
            compiler: harness.createCompiler(),
            parser: {
                isFormula: () => false,
                readFormula: () => null,
                isCodeBlock: () => false,
                readCodeBlock: () => null,
            },
            createEpochId: () => harness.epochId,
        });
        module.init();
        const ref = module.read().kind === 'ready' ? module.read().entries[2]!.ref : null;
        const result = await module.locate({ kind: 'entry', ref: ref! }, { timeoutMs: 500 });

        expect(result).toMatchObject({ kind: 'located', phase: 'hydrated' });
        expect(module.read().kind).toBe('ready');
        module.dispose();
    });

    it('does not replace a sealed turn when an identical hydration remounts', async () => {
        const harness = createHarness(2);
        const module = new ConversationDiscoveryModuleV2({
            host: harness.host,
            compiler: harness.createCompiler(),
            parser: {
                isFormula: () => false,
                readFormula: () => null,
                isCodeBlock: () => false,
                readCodeBlock: () => null,
            },
            createEpochId: () => harness.epochId,
        });
        module.init();
        harness.emitMount(harness.rounds[0]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const first = module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-1' });
        expect(first.kind).toBe('ready');
        const firstToken = first.kind === 'ready' ? first.turn.turnToken : '';
        harness.emitUnmount(harness.rounds[0]!);
        harness.emitMount(harness.rounds[0]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const second = module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-1' });
        expect(second.kind).toBe('ready');
        if (second.kind === 'ready') expect(second.turn.turnToken).toBe(firstToken);
        module.dispose();
    });

    it('updates topology position without changing a sealed turn or content token', async () => {
        const harness = createHarness(2);
        const module = new ConversationDiscoveryModuleV2({
            host: harness.host,
            compiler: harness.createCompiler(),
            parser: {
                isFormula: () => false,
                readFormula: () => null,
                isCodeBlock: () => false,
                readCodeBlock: () => null,
            },
            createEpochId: () => harness.epochId,
        });
        module.init();
        harness.emitMount(harness.rounds[0]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const before = module.read();
        if (before.kind !== 'ready') throw new Error('expected ready snapshot');
        const first = module.readTurn({ kind: 'entry', ref: before.entries[0]!.ref });
        if (first.kind !== 'ready') throw new Error('expected sealed turn');

        const prepended = createRounds(harness.epochId, 3);
        const prependedRounds = prepended.map((round, index) => index === 0
            ? Object.freeze({
                ...round,
                entry: Object.freeze({ ...round.entry, slotKey: 'round-prepended' }),
                userSlotKey: 'user-prepended',
                assistantSlotKey: 'assistant-prepended',
            })
            : harness.rounds[index - 1]!);
        harness.dispatch([{
            kind: 'topology-replaced',
            topologyToken: 'topology:prepended',
            leadingUnpairedSlots: 0,
            trailingUnpairedSlots: 0,
            rounds: prependedRounds,
        }]);

        const after = module.read();
        if (after.kind !== 'ready') throw new Error('expected ready snapshot');
        const moved = module.readTurn({ kind: 'entry', ref: first.ref });
        expect(moved).toMatchObject({ kind: 'ready', position: 2 });
        if (moved.kind === 'ready') expect(moved.turn.turnToken).toBe(first.turn.turnToken);
        expect(after.tokens.contentToken).toBe(before.tokens.contentToken);
        expect(after.revisions.content).toBe(before.revisions.content);
        module.dispose();
    });

    it('retries an unsealed stable surface after a later body mutation', async () => {
        const harness = createHarness(1);
        let attempts = 0;
        const compiler: RenderedContentCompilerV2 = {
            compile: async (request) => {
                attempts += 1;
                if (attempts === 1) return { kind: 'rejected', reason: 'empty-content' };
                return harness.createCompiler().compile(request);
            },
        };
        const module = new ConversationDiscoveryModuleV2({
            host: harness.host,
            compiler,
            parser: {
                isFormula: () => false,
                readFormula: () => null,
                isCodeBlock: () => false,
                readCodeBlock: () => null,
            },
            createEpochId: () => harness.epochId,
        });
        module.init();
        harness.emitMount(harness.rounds[0]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        expect(module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-1' }))
            .toEqual({ kind: 'unavailable', reason: 'not-recognized' });

        harness.emitMount(harness.rounds[0]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        expect(attempts).toBe(2);
        expect(module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-1' }).kind)
            .toBe('ready');
        module.dispose();
    });

    it('fences duplicate and old host batches and changes projection on identity replacement', async () => {
        const harness = createHarness(2);
        const module = new ConversationDiscoveryModuleV2({
            host: harness.host,
            compiler: harness.createCompiler(),
            parser: {
                isFormula: () => false,
                readFormula: () => null,
                isCodeBlock: () => false,
                readCodeBlock: () => null,
            },
            createEpochId: () => harness.epochId,
        });
        module.init();
        harness.emitMount(harness.rounds[0]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const initial = module.read();
        if (initial.kind !== 'ready') throw new Error('expected ready snapshot');
        const oldProjection = initial.document.projectionId;
        const oldToken = initial.tokens.contentToken;

        harness.emitMount(harness.rounds[1]!);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const beforeDuplicate = module.read();
        if (beforeDuplicate.kind !== 'ready') throw new Error('expected ready snapshot');
        const duplicateChange = harness.dispatch([
            {
                kind: 'role-mounted',
                surface: Object.freeze({
                    entry: harness.rounds[1]!.entry,
                    role: 'assistant' as const,
                    lifecycle: 'stable' as const,
                    turnId: 'turn-2',
                    messageId: 'assistant-2',
                    surfaceToken: 'round-2:assistant:assistant-2',
                    anchorElement: document.createElement('div'),
                    messageElement: document.createElement('section'),
                    contentRootElement: document.createElement('section'),
                }),
            },
        ]);
        const afterFirstDuplicate = module.read();
        if (afterFirstDuplicate.kind !== 'ready') throw new Error('expected ready snapshot');
        const afterFirstMaterializationToken = afterFirstDuplicate.tokens.materializationToken;
        harness.replay(duplicateChange);
        harness.replay({ ...duplicateChange, batchId: 'old-batch', hostRevision: 1 });
        const afterDuplicate = module.read();
        if (afterDuplicate.kind !== 'ready') throw new Error('expected ready snapshot');
        expect(afterDuplicate.tokens.materializationToken).toBe(afterFirstMaterializationToken);

        harness.emitMount(harness.rounds[0]!, 'assistant-regenerated');
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const regenerated = module.read();
        if (regenerated.kind !== 'ready') throw new Error('expected ready snapshot');
        expect(regenerated.document.projectionId).not.toBe(oldProjection);
        expect(regenerated.tokens.contentToken).not.toBe(oldToken);
        expect(module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-regenerated' }).kind)
            .toBe('ready');
        expect(module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-2' }))
            .toEqual({ kind: 'unavailable', reason: 'not-recognized' });
        expect(module.readTurn({ kind: 'assistant-message', documentKey: 'chatgpt:conversation:conversation-1', assistantMessageId: 'assistant-1' }))
            .toEqual({ kind: 'unavailable', reason: 'not-recognized' });
        module.dispose();
    });
});
