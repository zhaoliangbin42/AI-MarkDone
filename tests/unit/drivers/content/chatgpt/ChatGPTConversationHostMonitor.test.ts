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
        <div data-turn-id-container="user-slot-${index}">
            <section data-turn="user" data-turn-id="user-slot-${index}" data-turn-id-container="user-slot-${index}">
                <div data-message-author-role="user" data-message-id="user-${index}">
                    <div class="whitespace-pre-wrap">Question ${index}</div>
                </div>
            </section>
        </div>
        <div data-turn-id-container="assistant-slot-${index}">
            <section data-turn="assistant" data-turn-id="assistant-slot-${index}" data-turn-id-container="assistant-slot-${index}">
                <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                    <div class="markdown prose">${answer}</div>
                </div>
                ${withAction ? '<div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>' : ''}
            </section>
        </div>
    `;
}

function assistantOnlyHtml(index: number, answer: string): string {
    return `
        <div data-turn-id-container="assistant-slot-${index}">
            <section data-turn="assistant" data-turn-id="assistant-slot-${index}" data-turn-id-container="assistant-slot-${index}">
                <div data-message-author-role="assistant" data-message-id="assistant-${index}">
                    <div class="markdown prose">${answer}</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        </div>
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

    it('does not recompile an unchanged completed message after a pure virtualized remount', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const harness = createHarness('remount-idempotent');

        try {
            harness.monitor.init();
            await settle();
            const initialToken = harness.repository.read().snapshot?.contentToken;

            main.innerHTML = '';
            await settle();
            main.innerHTML = roundHtml(1, 'Answer 1');
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot?.contentToken).toBe(initialToken);
            expect(harness.repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Answer 1');

            document.querySelector<HTMLElement>('.markdown.prose')!.textContent = 'Updated answer';
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(2);
            expect(harness.repository.read().snapshot?.contentToken).not.toBe(initialToken);
            expect(harness.repository.read().snapshot?.turns[0]?.assistantMarkdown).toBe('Updated answer');
        } finally {
            harness.dispose();
        }
    });

    it('recompiles an assistant-only capture when its user prompt remounts', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = assistantOnlyHtml(1, 'Answer 1');
        const harness = createHarness('remount-prompt');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.repository.read().snapshot?.turns[0]?.userText).toBe('');

            main.innerHTML = roundHtml(1, 'Answer 1');
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(2);
            expect(harness.repository.read().snapshot?.turns[0]?.userText).toBe('Question 1');
        } finally {
            harness.dispose();
        }
    });

    it('recompiles a complete pair when its mounted user message hydrates later', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const prompt = main.querySelector<HTMLElement>('[data-message-author-role="user"]');
        if (!prompt) throw new Error('fixture prompt is missing');
        prompt.textContent = '';
        const harness = createHarness('late-prompt-hydration');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.repository.read().snapshot?.turns[0]?.userText).toBe('');

            prompt.textContent = 'Question 1 loaded after the pair mounted';
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(2);
            expect(harness.repository.read().snapshot?.turns[0]?.userText).toBe(
                'Question 1 loaded after the pair mounted',
            );
        } finally {
            harness.dispose();
        }
    });

    it('keeps stable message order when historical loading renumbers host turn test ids', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(3, 'Answer 3') + roundHtml(4, 'Answer 4');
        Array.from(main.querySelectorAll<HTMLElement>('[data-turn]')).forEach((element, index) => {
            element.dataset.testid = `conversation-turn-${index + 5}`;
        });
        const harness = createHarness('renumbered-history');

        try {
            harness.monitor.init();
            await settle();

            main.insertAdjacentHTML('afterbegin', roundHtml(1, 'Answer 1') + roundHtml(2, 'Answer 2'));
            Array.from(main.querySelectorAll<HTMLElement>('[data-turn]')).forEach((element, index) => {
                element.dataset.testid = `conversation-turn-${index + 1}`;
            });
            await settle();

            expect(harness.repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
                'assistant-3',
                'assistant-4',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('fills a previously empty historical host slot at its original position', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = `
            <div data-turn-id-container="user-slot-1"></div>
            <div data-turn-id-container="assistant-slot-1"></div>
            ${roundHtml(2, 'Answer 2')}
            ${roundHtml(3, 'Answer 3')}
        `;
        const harness = createHarness('empty-history-slot');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
                'assistant-2',
                'assistant-3',
            ]);

            main.querySelector<HTMLElement>('[data-turn-id-container="user-slot-1"]')!.innerHTML = `
                <section data-turn="user" data-turn-id="user-slot-1" data-turn-id-container="user-slot-1">
                    <div data-message-author-role="user" data-message-id="user-1">
                        <div class="whitespace-pre-wrap">Question 1</div>
                    </div>
                </section>
            `;
            main.querySelector<HTMLElement>('[data-turn-id-container="assistant-slot-1"]')!.innerHTML = `
                <section data-turn="assistant" data-turn-id="assistant-slot-1" data-turn-id-container="assistant-slot-1">
                    <div data-message-author-role="assistant" data-message-id="assistant-1">
                        <div class="markdown prose">Answer 1</div>
                    </div>
                    <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
                </section>
            `;
            await settle();

            expect(harness.repository.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual([
                'assistant-1',
                'assistant-2',
                'assistant-3',
            ]);
        } finally {
            harness.dispose();
        }
    });

    it('updates an empty-slot topology without recompiling mounted bodies', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const harness = createHarness('empty-slot-only');
        const ingest = vi.spyOn(harness.repository, 'ingestHostBatch');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            ingest.mockClear();

            main.insertAdjacentHTML('afterbegin', '<div data-turn-id-container="historical-empty-slot"></div>');
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(ingest).toHaveBeenCalledTimes(1);
            expect(ingest.mock.calls[0]?.[0]).toEqual([]);
            expect(ingest.mock.calls[0]?.[1]).toEqual([
                'historical-empty-slot',
                'user-slot-1',
                'assistant-slot-1',
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
