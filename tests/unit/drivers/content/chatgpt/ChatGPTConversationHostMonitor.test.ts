import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createConversationDocumentKeyV1,
    type ConversationDocumentRefV1,
} from '@/contracts/conversationContent';
import type { RenderedContentCompilerV2 } from '@/contracts/conversationDiscoveryV2';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationHostMonitor } from '@/drivers/content/chatgpt/ChatGPTConversationHostMonitor';
import { getChatGPTPageIndex } from '@/drivers/content/chatgpt/domConversationDiscovery';
import { ConversationContentRepository } from '@/services/content/ConversationContentRepository';

function documentRef(id: string): ConversationDocumentRefV1 {
    return {
        key: createConversationDocumentKeyV1('chatgpt', id),
        platformId: 'chatgpt',
        conversationId: id,
        canonicalUrl: `https://chatgpt.com/c/${id}`,
    };
}

function roundHtml(index: number, answer: string, withAction = true): string {
    return `
        <section data-turn="user" data-turn-id="turn-${index}">
            <div data-message-author-role="user" data-message-id="user-${index}">
                <div class="whitespace-pre-wrap">Question ${index}</div>
            </div>
        </section>
        <section data-turn="assistant" data-turn-id="turn-${index}">
            <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                <div class="markdown prose">${answer}</div>
            </div>
            ${withAction ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>' : ''}
        </section>
    `;
}

function assistantOnlyHtml(index: number, answer: string): string {
    return `
        <section data-turn="assistant" data-turn-id="turn-${index}">
            <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                <div class="markdown prose">${answer}</div>
            </div>
            <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
        </section>
    `;
}

function compiler(): RenderedContentCompilerV2 {
    return {
        compile: vi.fn(async (request) => {
            const user = request.userRootClone.textContent?.trim() ?? '';
            const assistant = request.assistantRootClone.textContent?.trim() ?? '';
            return {
                kind: 'ready' as const,
                user: { markdown: user, text: user },
                assistant: { markdown: assistant, text: assistant },
                semanticDigest: `digest:${user}:${assistant}`,
                surfaceDigest: `surface:${assistant}`,
                manifest: {
                    nodeCount: 2,
                    formulaCount: 0,
                    codeBlockCount: 0,
                    tableCount: 0,
                    imageCount: 0,
                },
            };
        }),
    };
}

function createHarness(id: string, settleDelayMs = 20) {
    const currentDocument = documentRef(id);
    const adapter = new ChatGPTAdapter();
    const repository = new ConversationContentRepository({
        resolveDocument: () => currentDocument,
    });
    const renderedCompiler = compiler();
    const monitor = new ChatGPTConversationHostMonitor({
        adapter,
        index: getChatGPTPageIndex(adapter),
        repository,
        resolveDocument: () => currentDocument,
        settleDelayMs,
        compiler: renderedCompiler,
    });
    return {
        adapter,
        repository,
        renderedCompiler,
        monitor,
        dispose() {
            monitor.dispose();
            repository.dispose();
            adapter.dispose();
        },
    };
}

async function settle(delay = 20): Promise<void> {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(delay);
    await Promise.resolve();
}

describe('ChatGPTConversationHostMonitor DOM readiness', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', '/');
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('captures official-action messages already present at initialization', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Initial answer');
        const harness = createHarness('initial');

        try {
            harness.monitor.init();
            await settle();

            expect(harness.repository.read().snapshot?.turns).toMatchObject([
                {
                    userText: 'Question 1',
                    assistantMarkdown: 'Initial answer',
                    identity: { assistantMessageId: 'assistant-1' },
                },
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('waits indefinitely for the official action row and reacts to its mutation once', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Delayed answer', false);
        const harness = createHarness('delayed');

        try {
            harness.monitor.init();
            await vi.advanceTimersByTimeAsync(30_000);
            expect(harness.renderedCompiler.compile).not.toHaveBeenCalled();

            document.querySelector('[data-turn="assistant"]')!.insertAdjacentHTML(
                'beforeend',
                '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>',
            );
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot?.turns).toHaveLength(1);
        } finally {
            harness.dispose();
        }
    });

    it('does not read while generation is active and reads after generation ends', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Streaming answer');
        document.body.insertAdjacentHTML('beforeend', '<button data-testid="stop-button">Stop</button>');
        const harness = createHarness('generation');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).not.toHaveBeenCalled();

            document.querySelector('[data-testid="stop-button"]')?.remove();
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Streaming answer');
        } finally {
            harness.dispose();
        }
    });

    it('accepts an assistant-only mounted message', async () => {
        document.querySelector('main')!.innerHTML = assistantOnlyHtml(1, 'Assistant only');
        const harness = createHarness('assistant-only');

        try {
            harness.monitor.init();
            await settle();

            expect(harness.repository.read().snapshot?.turns[0]).toMatchObject({
                userText: '',
                assistantMarkdown: 'Assistant only',
                identity: { userMessageId: null, assistantMessageId: 'assistant-1' },
            });
        } finally {
            harness.dispose();
        }
    });

    it('adds a later message and retains a virtualized earlier message', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const harness = createHarness('append-retain');

        try {
            harness.monitor.init();
            await settle();
            main.insertAdjacentHTML('beforeend', roundHtml(2, 'Answer 2'));
            await settle();
            main.querySelector('[data-turn="user"]')?.remove();
            main.querySelector('[data-turn="assistant"]')?.remove();
            await settle();

            expect(harness.repository.read().snapshot?.turns.map((item) => item.assistantMarkdown)).toEqual([
                'Answer 1',
                'Answer 2',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('updates changed DOM content and leaves identical content token-stable', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Answer');
        const harness = createHarness('update');

        try {
            harness.monitor.init();
            await settle();
            const initialToken = harness.repository.read().snapshot?.contentToken;
            const content = document.querySelector<HTMLElement>('.markdown.prose')!;
            content.textContent = 'Answer';
            await settle();
            expect(harness.repository.read().snapshot?.contentToken).toBe(initialToken);

            content.textContent = 'Updated answer';
            await settle();
            expect(harness.repository.read().snapshot?.contentToken).not.toBe(initialToken);
            expect(harness.repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Updated answer');
        } finally {
            harness.dispose();
        }
    });

    it('coalesces a large mutation burst into one capture', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'token-0');
        const harness = createHarness('coalesced');
        const content = document.querySelector<HTMLElement>('.markdown.prose')!;

        try {
            harness.monitor.init();
            for (let index = 1; index <= 1_000; index += 1) content.textContent = `token-${index}`;
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('token-1000');
        } finally {
            harness.dispose();
        }
    });

    it('rescans mounted content on a page lifecycle wake', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Wake answer');
        const harness = createHarness('wake');

        try {
            harness.monitor.init();
            await settle();
            harness.monitor.notifyPageShow();
            await settle();

            expect(harness.repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Wake answer');
            expect(harness.monitor.readDiagnosticsFacts().stableCaptureCount).toBe(2);
        } finally {
            harness.dispose();
        }
    });
});
