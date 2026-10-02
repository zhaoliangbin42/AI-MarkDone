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
    let currentDocument = documentRef(id);
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
        setDocument(id: string) {
            currentDocument = documentRef(id);
        },
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

    it('captures the current one-slot-per-round page when the GET graph is unavailable', async () => {
        document.querySelector('main')!.innerHTML = `
          <div data-turn-key="user-1">
            <div data-content-search-turn-key="round-1">
              <div data-chatgpt-search-unit-key="round-1:0:user" data-chatgpt-search-message-ids="user-1">Question 1</div>
              <div class="group flex flex-col pb-2 pt-2">
                <div data-chatgpt-search-unit-key="round-1:2:assistant" data-chatgpt-search-message-ids="assistant-1 assistant-1">
                  <div data-markdown-text-style="assistant-message">Initial answer</div>
                </div>
                <div class="turn-action-controls"><button aria-label="复制">Copy</button></div>
              </div>
            </div>
          </div>`;
        const harness = createHarness('current-dom');
        try {
            harness.monitor.init();
            await settle();
            expect(harness.repository.read().snapshot?.turns).toMatchObject([{
                userText: 'Question 1',
                assistantMarkdown: 'Initial answer',
                identity: { turnId: 'round-1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
            }]);
        } finally { harness.dispose(); }
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

    it('keeps a rejected capture retryable across remounts until a connecting topology admits it', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer 1');
        const harness = createHarness('rejected-remount');

        try {
            harness.monitor.init();
            await settle();
            main.innerHTML = roundHtml(3, 'Answer 3');
            await settle();

            expect(harness.repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1',
            ]);
            expect(harness.monitor.readDiagnosticsFacts().dirtyAssistantCount).toBe(1);
            const refusedCaptureCount = vi.mocked(harness.renderedCompiler.compile).mock.calls.length;
            await settle(5_000);
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(refusedCaptureCount);

            main.innerHTML = '';
            await settle();
            main.innerHTML = roundHtml(3, 'Answer 3');
            await settle();
            expect(harness.monitor.readDiagnosticsFacts().dirtyAssistantCount).toBe(1);

            main.innerHTML = roundHtml(1, 'Answer 1') + roundHtml(2, 'Answer 2') + roundHtml(3, 'Answer 3');
            await settle();
            expect(harness.repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1', 'assistant-2', 'assistant-3',
            ]);
            expect(harness.monitor.readDiagnosticsFacts().dirtyAssistantCount).toBe(0);
            const token = harness.repository.read().snapshot?.contentToken;
            const captureCount = vi.mocked(harness.renderedCompiler.compile).mock.calls.length;

            main.innerHTML = roundHtml(1, 'Answer 1') + roundHtml(2, 'Answer 2') + roundHtml(3, 'Answer 3');
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(captureCount);
            expect(harness.repository.read().snapshot?.contentToken).toBe(token);
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

    it('fills the real prompt once when an exact assistant entity outlives its provisional outer marker', async () => {
        const main = document.querySelector('main')!;
        const assistant = `
            <section data-turn="assistant">
                <div data-message-author-role="assistant" data-message-id="assistant-1">
                    <div class="markdown prose">Answer 1</div>
                </div>
                <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
            </section>
        `;
        main.innerHTML = `<div data-turn-key="fallback-turn-0">${assistant}</div>`;
        const harness = createHarness('provisional-assistant-owner');

        try {
            harness.monitor.init();
            await settle();
            const initial = harness.repository.read().snapshot;
            expect(initial?.turns).toMatchObject([{
                identity: { userMessageId: null, assistantMessageId: 'assistant-1' },
                userText: '', assistantMarkdown: 'Answer 1',
            }]);
            expect(initial?.turns).toHaveLength(1);
            const turnId = initial!.turns[0]!.identity.turnId;

            main.innerHTML = `<div data-turn-key="opaque-stable-slot">
                <section data-turn="user">
                    <div data-message-author-role="user" data-message-id="user-1">
                        <div class="whitespace-pre-wrap">Question 1</div>
                    </div>
                </section>
                ${assistant}
            </div>`;
            await settle();

            const current = harness.repository.read().snapshot;
            expect(current?.turns).toHaveLength(1);
            expect(current?.turns[0]).toMatchObject({
                identity: { turnId, userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
                userText: 'Question 1', assistantMarkdown: 'Answer 1',
            });
            expect(harness.repository.readDiagnosticsFacts().turnCount).toBe(1);
            expect(harness.monitor.readDiagnosticsFacts().admissionRejections?.['identity-conflict'] ?? 0).toBe(0);
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

    it('preserves transient overlap before coalesced body capture sees a disjoint historical window', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = [4, 5, 6].map((index) => roundHtml(index, `Answer ${index}`)).join('');
        const harness = createHarness('transient-overlap');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(3);

            main.innerHTML = [2, 3, 4].map((index) => roundHtml(index, `Answer ${index}`)).join('');
            await Promise.resolve();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(3);
            main.innerHTML = [1, 2, 3].map((index) => roundHtml(index, `Answer ${index}`)).join('');
            await settle();

            expect(harness.repository.read().snapshot?.turns.map((turn) => turn.identity.assistantMessageId)).toEqual([
                'assistant-1', 'assistant-2', 'assistant-3', 'assistant-4', 'assistant-5', 'assistant-6',
            ]);
            expect(harness.repository.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Answer 5', 'Answer 6',
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
        const admission = vi.spyOn(harness.repository, 'admitHostBatch');

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            admission.mockClear();

            main.insertAdjacentHTML('afterbegin', '<div data-turn-id-container="historical-empty-slot"></div>');
            await settle();

            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(admission).toHaveBeenCalledWith([], [
                'historical-empty-slot',
                'user-slot-1',
                'assistant-slot-1',
            ], [{ hostSlotId: 'assistant-slot-1', assistantMessageId: 'assistant-1', userMessageId: null }], undefined);
            expect(admission.mock.calls.every(([observations]) => observations.length === 0)).toBe(true);
            expect(admission.mock.results.every((result) => (
                result.type === 'return' && result.value.admittedAssistantMessageIds.length === 0
            ))).toBe(true);
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

    it('publishes obtained messages while hydration keeps producing mutations', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Ready answer');
        const harness = createHarness('continuous-hydration');
        const content = document.querySelector<HTMLElement>('.markdown.prose')!;
        try {
            harness.monitor.init();
            for (let index = 0; index < 12; index += 1) {
                content.textContent = `Hydration ${index}`;
                await Promise.resolve();
                await vi.advanceTimersByTimeAsync(10);
            }
            expect(harness.repository.read().snapshot?.turns).toHaveLength(1);
            expect(harness.renderedCompiler.compile).toHaveBeenCalled();
        } finally {
            harness.dispose();
        }
    });

    it('keeps obtained clones when a different message mounts during compilation', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Ready 1') + roundHtml(2, 'Ready 2');
        const harness = createHarness('progressive-capture');
        const delegate = compiler().compile;
        vi.mocked(harness.renderedCompiler.compile).mockImplementationOnce(async request => {
            document.querySelector('main')!.insertAdjacentHTML('beforeend', roundHtml(3, 'Ready 3'));
            return delegate(request);
        });
        try {
            harness.monitor.init();
            await settle();
            expect(harness.repository.read().snapshot?.turns).toHaveLength(2);
            await settle();
            expect(harness.repository.read().snapshot?.turns).toHaveLength(3);
        } finally {
            harness.dispose();
        }
    });

    it('does not bind an obsolete assistant clone when its connected owner changes identity during compilation', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Obsolete answer');
        const harness = createHarness('owner-identity-change');
        let releaseCompilation!: () => void;
        const blockedCompilation = new Promise<void>((resolve) => { releaseCompilation = resolve; });
        const delegate = compiler().compile;
        vi.mocked(harness.renderedCompiler.compile).mockImplementationOnce(async (request) => {
            await blockedCompilation;
            return delegate(request);
        });

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot).toBeNull();

            const owner = main.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
            owner.setAttribute('data-message-id', 'assistant-2');
            owner.querySelector<HTMLElement>('.markdown.prose')!.textContent = 'Replacement answer';
            await Promise.resolve();
            expect(owner.isConnected).toBe(true);
            releaseCompilation();
            await settle(60);

            expect(harness.repository.read().snapshot?.turns).toMatchObject([{
                identity: { assistantMessageId: 'assistant-2' },
                assistantMarkdown: 'Replacement answer',
            }]);
            expect(harness.repository.read().snapshot?.turns).toHaveLength(1);
        } finally {
            releaseCompilation();
            harness.dispose();
        }
    });

    it('does not bind an obsolete detached clone when the connected host slot contains a replacement message', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Obsolete answer');
        const harness = createHarness('slot-owner-replacement');
        let releaseCompilation!: () => void;
        const blockedCompilation = new Promise<void>((resolve) => { releaseCompilation = resolve; });
        const delegate = compiler().compile;
        vi.mocked(harness.renderedCompiler.compile).mockImplementationOnce(async (request) => {
            await blockedCompilation;
            return delegate(request);
        });

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot).toBeNull();

            const slot = main.querySelector<HTMLElement>('[data-turn-id-container="assistant-slot-1"]')!;
            const originalMessage = slot.querySelector<HTMLElement>('[data-message-author-role="assistant"]')!;
            const replacement = document.createElement('div');
            replacement.setAttribute('data-message-author-role', 'assistant');
            replacement.setAttribute('data-message-id', 'assistant-2');
            replacement.innerHTML = '<div class="markdown prose">Replacement answer</div>';
            originalMessage.replaceWith(replacement);
            await Promise.resolve();
            expect(originalMessage.isConnected).toBe(false);
            expect(slot.isConnected).toBe(true);
            releaseCompilation();
            await settle(60);

            expect(harness.repository.read().snapshot?.turns).toMatchObject([{
                identity: { assistantMessageId: 'assistant-2' },
                assistantMarkdown: 'Replacement answer',
            }]);
            expect(harness.repository.read().snapshot?.turns).toHaveLength(1);
        } finally {
            releaseCompilation();
            harness.dispose();
        }
    });

    it('fences a compiled observation when its document changes before compilation finishes', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1, 'Answer from A');
        const harness = createHarness('route-a');
        let releaseCompilation!: () => void;
        const blockedCompilation = new Promise<void>((resolve) => { releaseCompilation = resolve; });
        const delegate = compiler().compile;
        vi.mocked(harness.renderedCompiler.compile).mockImplementationOnce(async (request) => {
            await blockedCompilation;
            return delegate(request);
        });

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            expect(harness.repository.read().snapshot).toBeNull();

            harness.setDocument('route-b');
            main.innerHTML = roundHtml(2, 'Answer from B');
            harness.monitor.notifyRouteChanged(true);
            releaseCompilation();
            await settle(60);

            expect(harness.repository.read().document?.key).toBe(documentRef('route-b').key);
            expect(harness.repository.read().snapshot?.turns.map((turn) => turn.assistantMarkdown)).toEqual([
                'Answer from B',
            ]);
        } finally {
            releaseCompilation();
            harness.dispose();
        }
    });

    it('does not admit a compiled observation after the monitor is disposed', async () => {
        document.querySelector('main')!.innerHTML = roundHtml(1, 'Late answer');
        const harness = createHarness('dispose-inflight');
        let releaseCompilation!: () => void;
        const blockedCompilation = new Promise<void>((resolve) => { releaseCompilation = resolve; });
        const delegate = compiler().compile;
        vi.mocked(harness.renderedCompiler.compile).mockImplementationOnce(async (request) => {
            await blockedCompilation;
            return delegate(request);
        });

        try {
            harness.monitor.init();
            await settle();
            expect(harness.renderedCompiler.compile).toHaveBeenCalledTimes(1);
            harness.monitor.dispose();
            releaseCompilation();
            await settle();

            expect(harness.repository.read().snapshot).toBeNull();
            expect(harness.monitor.readDiagnosticsFacts().dirtyAssistantCount).toBe(0);
        } finally {
            releaseCompilation();
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
