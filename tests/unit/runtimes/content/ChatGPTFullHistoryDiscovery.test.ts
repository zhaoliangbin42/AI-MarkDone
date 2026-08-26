import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
    type ConversationTurnV1,
} from '@/contracts/conversationContent';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTFullHistoryDiscoveryController } from '@/runtimes/content/ChatGPTFullHistoryDiscovery';
import { ConversationContentRepository } from '@/services/content/ConversationContentRepository';

function documentRef(): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', 'full-history'),
        platformId: 'chatgpt',
        conversationId: 'full-history',
        canonicalUrl: 'https://chatgpt.com/c/full-history',
    };
}

function turn(index: number): ConversationTurnV1 {
    return {
        key: `turn-${index}:assistant-${index}`,
        ordinal: index,
        identity: {
            turnId: `turn-${index}`,
            userMessageId: `user-${index}`,
            assistantMessageId: `assistant-${index}`,
        },
        userText: `Question ${index}`,
        assistantMarkdown: `Answer ${index}`,
        assistantProvenance: {
            authority: 'host-rendered',
            fidelity: 'normalized',
            producer: 'chatgpt-full-dom-discovery',
        },
    };
}

describe('ChatGPTFullHistoryDiscoveryController', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.documentElement.innerHTML = `
            <head></head>
            <body>
                <main>
                    <div class="qMYqUG_convSearchResultHighlightRoot">
                        <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2">
                            <button aria-label="Prompt 1"></button>
                            <button aria-label="Prompt 2"></button>
                        </div>
                    </div>
                    <div id="slots">
                        <div data-turn-id-container="assistant-slot-1"></div>
                        <div data-turn-id-container="assistant-slot-2"></div>
                    </div>
                </main>
            </body>
        `;
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('sweeps the persistent host slots and marks one shared repository complete', async () => {
        const adapter = new ChatGPTAdapter();
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef() });
        repository.ingestHostBatch([
            { turn: turn(1), hostSlotId: 'assistant-slot-1', origin: 'full-discovery' },
            { turn: turn(2), hostSlotId: 'assistant-slot-2', origin: 'full-discovery' },
        ], ['assistant-slot-1', 'assistant-slot-2']);

        const pageIndex = {
            invalidate: vi.fn(),
            subscribeObservations: vi.fn(() => () => undefined),
        } as any;
        const surface = { refreshSurface: vi.fn() };
        const hostMonitor = {
            setCaptureOrigin: vi.fn(),
            requestCapture: vi.fn(),
            flushObserved: vi.fn(async () => undefined),
        };
        const controller = new ChatGPTFullHistoryDiscoveryController({
            adapter,
            pageIndex,
            surface,
            hostMonitor,
            repository,
            timeoutMs: 500,
        });

        await controller.start();

        expect(controller.readState()).toMatchObject({
            status: 'complete',
            expectedTurnCount: 2,
        });
        expect(repository.read().snapshot?.historyStatus).toBe('complete');
        expect(pageIndex.invalidate).toHaveBeenCalled();
        expect(surface.refreshSurface).toHaveBeenCalled();
        expect(hostMonitor.requestCapture).toHaveBeenCalledWith('full-discovery');

        controller.dispose();
        repository.dispose();
        adapter.dispose();
    });

    it('keeps a partial status when the navigation skeleton is absent', async () => {
        document.querySelector('.qMYqUG_convSearchResultHighlightRoot')?.remove();
        const adapter = new ChatGPTAdapter();
        const repository = new ConversationContentRepository({ resolveDocument: () => documentRef() });
        const controller = new ChatGPTFullHistoryDiscoveryController({
            adapter,
            pageIndex: { invalidate: vi.fn(), subscribeObservations: vi.fn(() => () => undefined) } as any,
            surface: { refreshSurface: vi.fn() },
            hostMonitor: {
                setCaptureOrigin: vi.fn(),
                requestCapture: vi.fn(),
                flushObserved: vi.fn(async () => undefined),
            },
            repository,
            timeoutMs: 50,
        });

        const start = controller.start();
        await vi.advanceTimersByTimeAsync(60);
        await start;

        expect(controller.readState().status).toBe('partial');
        expect(repository.read().snapshot).toBeNull();

        controller.dispose();
        repository.dispose();
        adapter.dispose();
    });
});
