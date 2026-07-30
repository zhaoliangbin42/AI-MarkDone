import { describe, expect, it } from 'vitest';
import {
    createChatGPTConversationModel,
    reduceChatGPTConversation,
    type ChatGPTConversationModel,
} from '@/drivers/content/chatgpt/ChatGPTConversationReducer';

const conversationId = '695499b7-464c-8323-a998-119f661ac953';

function domRound(
    index: number,
    status: 'streaming' | 'complete' | 'incomplete',
    assistantContent = `Answer ${index}`,
) {
    return {
        position: index,
        roundId: `user-turn-${index}`,
        userMessageId: `user-${index}`,
        assistantMessageId: `assistant-${index}`,
        assistantTurnId: `assistant-turn-${index}`,
        userPrompt: `Question ${index}`,
        assistantContent: status === 'complete' ? assistantContent : '',
        status,
    } as const;
}

function graphRound(index: number, assistantContent = `Graph answer ${index}`) {
    return {
        id: `user-turn-${index}`,
        position: index,
        userPrompt: `Question ${index}`,
        assistantContent,
        preview: `Question ${index}`,
        messageId: assistantContent ? `assistant-${index}` : `user-${index}`,
        userMessageId: `user-${index}`,
        assistantMessageId: assistantContent ? `assistant-${index}` : null,
    };
}

function createBirthReadyModel(): ChatGPTConversationModel {
    let model = createChatGPTConversationModel();
    model = reduceChatGPTConversation(model, {
        kind: 'route',
        routeEpoch: 1,
        conversationId: null,
        allowBirth: true,
        preserveBirth: false,
    });
    model = reduceChatGPTConversation(model, {
        kind: 'route',
        routeEpoch: 2,
        conversationId,
        allowBirth: false,
        preserveBirth: true,
    });
    model = reduceChatGPTConversation(model, {
        kind: 'dom',
        routeEpoch: 2,
        conversationId,
        observation: {
            observedAt: 1,
            rounds: [domRound(1, 'streaming')],
        },
    });
    return reduceChatGPTConversation(model, {
        kind: 'dom',
        routeEpoch: 2,
        conversationId,
        observation: {
            observedAt: 2,
            rounds: [domRound(1, 'complete')],
        },
    });
}

describe('ChatGPTConversationReducer', () => {
    it('completes a graph-proven first pending round from matching DOM facts', () => {
        let model = createChatGPTConversationModel();
        model = reduceChatGPTConversation(model, {
            kind: 'route',
            routeEpoch: 1,
            conversationId,
            allowBirth: false,
            preserveBirth: false,
        });
        model = reduceChatGPTConversation(model, {
            kind: 'graph',
            routeEpoch: 1,
            conversationId,
            branchKey: 'user-turn-1',
            capturedAt: 1,
            rounds: [{
                id: 'user-turn-1',
                position: 1,
                userPrompt: 'Question 1',
                assistantContent: '',
                preview: 'Question 1',
                messageId: 'user-1',
                userMessageId: 'user-1',
                assistantMessageId: null,
            }],
        });

        expect(model.state).toMatchObject({
            status: 'collecting',
            conversationId,
            snapshot: null,
        });

        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 1,
            conversationId,
            observation: {
                observedAt: 2,
                rounds: [{
                    position: 1,
                    roundId: 'user-turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: 'assistant-1',
                    assistantTurnId: 'assistant-turn-1',
                    userPrompt: 'Question 1',
                    assistantContent: '**Answer 1**',
                    status: 'complete',
                }],
            },
        });

        expect(model.state.snapshot).toMatchObject({
            proof: 'observed-graph',
            branchKey: 'assistant-1',
            rounds: [{
                id: 'user-turn-1',
                assistantContent: '**Answer 1**',
                assistantMessageId: 'assistant-1',
            }],
        });
    });

    it('keeps the completed prefix stable and publishes each successor once', () => {
        let model = createBirthReadyModel();
        const firstSnapshot = model.state.snapshot;
        const firstRevision = model.state.revision;

        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 2,
            conversationId,
            observation: {
                observedAt: 3,
                rounds: [
                    domRound(1, 'complete'),
                    domRound(2, 'streaming'),
                ],
            },
        });
        expect(model.state.snapshot).toBe(firstSnapshot);
        expect(model.state.revision).toBe(firstRevision);

        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 2,
            conversationId,
            observation: {
                observedAt: 4,
                rounds: [
                    domRound(1, 'complete'),
                    domRound(2, 'complete'),
                ],
            },
        });
        expect(model.state.snapshot?.rounds).toHaveLength(2);
        const completedSnapshot = model.state.snapshot;
        const completedRevision = model.state.revision;

        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 2,
            conversationId,
            observation: {
                observedAt: 5,
                rounds: [
                    domRound(1, 'complete'),
                    domRound(2, 'complete'),
                ],
            },
        });
        expect(model.state.snapshot).toBe(completedSnapshot);
        expect(model.state.revision).toBe(completedRevision);
    });

    it('does not let an older pending graph regress a DOM-completed lineage', () => {
        let model = createBirthReadyModel();
        const completedSnapshot = model.state.snapshot;
        const completedRevision = model.state.revision;
        model = reduceChatGPTConversation(model, {
            kind: 'graph',
            routeEpoch: 2,
            conversationId,
            branchKey: 'user-turn-1',
            capturedAt: 3,
            rounds: [graphRound(1, '')],
        });

        expect(model.state.snapshot).toMatchObject({
            proof: 'observed-graph',
            branchKey: 'assistant-1',
            rounds: [{
                assistantContent: 'Answer 1',
                assistantMessageId: 'assistant-1',
            }],
        });
        expect(model.state.snapshot).not.toBe(completedSnapshot);
        const graphCalibratedRevision = model.state.revision;

        model = reduceChatGPTConversation(model, {
            kind: 'graph',
            routeEpoch: 2,
            conversationId,
            branchKey: 'user-turn-1',
            capturedAt: 4,
            rounds: [graphRound(1, '')],
        });
        expect(model.state.revision).toBe(graphCalibratedRevision);
        expect(model.state.revision).toBe(completedRevision + 1);
    });

    it('does not preserve DOM content across a conflicting pending graph lineage', () => {
        let model = createBirthReadyModel();
        model = reduceChatGPTConversation(model, {
            kind: 'graph',
            routeEpoch: 2,
            conversationId,
            branchKey: 'different-user-turn',
            capturedAt: 3,
            rounds: [{
                ...graphRound(1, ''),
                id: 'different-user-turn',
                userMessageId: 'different-user',
                messageId: 'different-user',
            }],
        });

        expect(model.state).toMatchObject({
            status: 'collecting',
            snapshot: null,
        });
    });

    it('lets a non-empty graph replace DOM content and resolve a branch conflict', () => {
        let model = createBirthReadyModel();
        model = reduceChatGPTConversation(model, {
            kind: 'graph',
            routeEpoch: 2,
            conversationId,
            branchKey: 'graph-assistant-1',
            capturedAt: 3,
            rounds: [{
                ...graphRound(1, 'Authoritative graph answer'),
                messageId: 'graph-assistant-1',
                assistantMessageId: 'graph-assistant-1',
            }],
        });

        expect(model.state.snapshot).toMatchObject({
            proof: 'observed-graph',
            branchKey: 'graph-assistant-1',
            rounds: [{
                assistantContent: 'Authoritative graph answer',
                assistantMessageId: 'graph-assistant-1',
            }],
        });
    });

    it('extends a graph baseline only after the typed DOM successor completes', () => {
        let model = createChatGPTConversationModel();
        model = reduceChatGPTConversation(model, {
            kind: 'route',
            routeEpoch: 1,
            conversationId,
            allowBirth: false,
            preserveBirth: false,
        });
        model = reduceChatGPTConversation(model, {
            kind: 'graph',
            routeEpoch: 1,
            conversationId,
            branchKey: 'assistant-1',
            capturedAt: 1,
            rounds: [graphRound(1)],
        });
        const baseline = model.state.snapshot;

        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 1,
            conversationId,
            observation: {
                observedAt: 2,
                rounds: [domRound(1, 'complete'), domRound(2, 'streaming')],
            },
        });
        expect(model.state.snapshot).toBe(baseline);

        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 1,
            conversationId,
            observation: {
                observedAt: 3,
                rounds: [domRound(1, 'complete'), domRound(2, 'complete')],
            },
        });
        expect(model.state.snapshot).toMatchObject({
            proof: 'observed-graph',
            branchKey: 'assistant-2',
            rounds: [
                { position: 1, assistantContent: 'Graph answer 1' },
                { position: 2, assistantContent: 'Answer 2' },
            ],
        });
    });

    it('withdraws the old snapshot immediately when a materialized typed identity conflicts', () => {
        let model = createBirthReadyModel();
        model = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 2,
            conversationId,
            observation: {
                observedAt: 3,
                rounds: [{
                    ...domRound(1, 'complete'),
                    assistantMessageId: 'regenerated-assistant',
                }],
            },
        });

        expect(model.state).toMatchObject({
            status: 'blocked',
            reason: 'identity-conflict',
            snapshot: null,
        });
    });

    it('fails closed for late DOM attachment and ignores stale-route facts', () => {
        let model = createChatGPTConversationModel();
        model = reduceChatGPTConversation(model, {
            kind: 'route',
            routeEpoch: 4,
            conversationId,
            allowBirth: false,
            preserveBirth: false,
        });
        const blocked = reduceChatGPTConversation(model, {
            kind: 'dom',
            routeEpoch: 4,
            conversationId,
            observation: {
                observedAt: 1,
                rounds: [domRound(1, 'complete')],
            },
        });
        expect(blocked.state).toMatchObject({
            status: 'blocked',
            reason: 'unproven-history',
            snapshot: null,
        });

        const stale = reduceChatGPTConversation(blocked, {
            kind: 'graph',
            routeEpoch: 3,
            conversationId,
            branchKey: 'stale-branch',
            capturedAt: 2,
            rounds: [graphRound(1)],
        });
        expect(stale).toBe(blocked);
    });
});
