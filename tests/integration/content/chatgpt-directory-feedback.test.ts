import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { ChatGPTConversationContentRuntime } from '@/runtimes/content/ChatGPTConversationContentRuntime';
import { ConversationNavigationCoordinator } from '@/services/content/ConversationNavigationCoordinator';
import { navigateChatGPTDirectoryTarget } from '@/ui/content/chatgptDirectory/navigation';
import { ChatGPTDirectoryController } from '@/ui/content/controllers/ChatGPTDirectoryController';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

const CONVERSATION_ID = '11111111-1111-1111-1111-111111111111';

function roundHtml(index: number): string {
    return `<div data-turn-id-container="user-slot-${index}">
      <section data-turn="user" data-turn-id="user-slot-${index}">
        <div data-message-author-role="user" data-message-id="user-${index}">Question ${index}</div>
      </section>
    </div><div data-turn-id-container="assistant-slot-${index}">
      <section data-turn="assistant" data-turn-id="assistant-slot-${index}">
        <div data-message-author-role="assistant" data-message-id="assistant-${index}">
          <div class="markdown prose">Answer ${index}</div>
        </div>
        <div class="z-0 flex"><button data-testid="copy-turn-action-button">Copy</button></div>
      </section>
    </div>`;
}

function emptyRoundHtml(index: number): string {
    return `<div data-turn-id-container="user-slot-${index}"></div><div data-turn-id-container="assistant-slot-${index}"></div>`;
}

async function settle(ms = 500): Promise<void> {
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
}

function createFixture(sourceReadyInitially = false) {
    let sourceReady = sourceReadyInitially;
    const bridge = vi.fn((event: Event) => {
        const detail = (event as CustomEvent).detail;
        const request = typeof detail === 'string' ? JSON.parse(detail) : detail;
        window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:response', { detail: {
            requestId: request.requestId,
            ok: sourceReady,
            ...(sourceReady ? { snapshot: {
                conversationId: CONVERSATION_ID, branchKey: 'assistant-24', capturedAt: Date.now(), captureSequence: 1,
                rounds: Array.from({ length: 24 }, (_, offset) => {
                    const index = offset + 1;
                    return { key: `user-slot-${index}:assistant-${index}`, ordinal: index,
                        identity: { turnId: `user-slot-${index}`, userMessageId: `user-${index}`, assistantMessageId: `assistant-${index}` },
                        userText: `Question ${index}`, assistantMarkdown: `Source answer ${index}` };
                }),
            } } : {}),
        } }));
    });
    window.addEventListener('aimd:chatgpt-conversation-bridge:request', bridge);
    const adapter = new ChatGPTAdapter();
    const runtime = new ChatGPTConversationContentRuntime(adapter, { hostSettleDelayMs: 20 });
    const navigation = new ConversationNavigationCoordinator({
        source: runtime.source,
        execute: (target, options, source) => navigateChatGPTDirectoryTarget(adapter, target, {
            surface: runtime.surface, source, signal: options.signal, timeoutMs: options.timeoutMs, deadlineMs: options.deadlineMs,
            seekStepPx: 3000, alignmentTimeoutMs: 1500,
        }),
    });
    runtime.setNavigationPort(navigation);
    const navigate = vi.spyOn(navigation, 'navigate');
    const directory = new ChatGPTDirectoryController(adapter, null, { surface: runtime.surface, navigation });
    return {
        adapter, runtime, directory, bridge, navigate,
        init() { runtime.init(); directory.init('light'); },
        captureSource() {
            sourceReady = true;
            window.dispatchEvent(new CustomEvent('aimd:chatgpt-conversation-bridge:capture', {
                detail: { kind: 'graph', conversationId: CONVERSATION_ID },
            }));
        },
        counts() {
            return {
                mounted: document.querySelectorAll('[data-message-author-role="assistant"]').length,
                snapshot: runtime.source.read().snapshot?.turns.length ?? 0,
                surface: runtime.surface.readFrame().obtainedTurns.length,
                directory: document.getElementById('aimd-chatgpt-directory-rail')?.shadowRoot?.querySelectorAll('.rail__item').length ?? 0,
            };
        },
        dispose() {
            directory.dispose(); navigation.cancelActive(); runtime.dispose(); adapter.dispose();
            window.removeEventListener('aimd:chatgpt-conversation-bridge:request', bridge);
        },
    };
}

describe('ChatGPT directory feedback through production composition', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        history.replaceState({}, '', `/c/${CONVERSATION_ID}`);
        document.documentElement.innerHTML = '<head></head><body><main></main></body>';
    });
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

    it('restores Directory and message controls after a retained-page switch and delayed native actions', async () => {
        const navigateHost = history.pushState.bind(history);
        document.body.innerHTML = `<div data-app-shell-active-page="true" id="page-a"><main>${roundHtml(1)}</main></div>
            <div data-app-shell-active-page="false" id="page-b"><main></main></div>`;
        const pageA = document.getElementById('page-a')!;
        const pageB = document.getElementById('page-b')!;
        const mainB = pageB.querySelector('main')!;
        const fixture = createFixture();
        const orchestrator = new MessageToolbarOrchestrator(fixture.adapter, {
            readerPanel: new ReaderPanel(),
            conversationContentSource: fixture.runtime.source,
            conversationMaterialization: fixture.runtime.materialization,
            conversationSurface: fixture.runtime.surface,
        });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false });
        const directoryLabels = () => Array.from(document.getElementById('aimd-chatgpt-directory-rail')!
            .shadowRoot!.querySelectorAll('.rail__item')).map(item => item.getAttribute('aria-label'));
        const toolbarCount = (root: ParentNode) => root.querySelectorAll('[data-aimd-role="message-toolbar"]').length;
        try {
            fixture.init();
            orchestrator.init();
            await settle();
            expect(directoryLabels()).toEqual(['#1 Question 1']);
            expect(toolbarCount(pageA)).toBe(1);

            // Host navigation runs outside the content script's isolated History wrapper.
            navigateHost({}, '', '/c/22222222-2222-2222-2222-222222222222');
            pageA.setAttribute('data-app-shell-active-page', 'false');
            pageB.setAttribute('data-app-shell-active-page', 'true');
            await settle();
            expect(pageA.isConnected).toBe(true);
            expect(directoryLabels()).toEqual([]);
            expect(toolbarCount(pageA)).toBe(0);

            mainB.innerHTML = roundHtml(2);
            const row = mainB.querySelector('.z-0')!;
            row.remove();
            await settle(5000);
            expect(toolbarCount(pageB)).toBe(0);
            mainB.querySelector('[data-turn="assistant"]')!.appendChild(row);
            await settle();
            expect(directoryLabels()).toEqual(['#1 Question 2']);
            expect(toolbarCount(pageB)).toBe(1);
            expect(fixture.runtime.source.read().snapshot?.turns.map(turn => turn.identity.assistantMessageId))
                .toEqual(['assistant-2']);

            // Cached pages resume via the activity attribute alone, without remounting messages.
            navigateHost({}, '', `/c/${CONVERSATION_ID}`);
            pageB.setAttribute('data-app-shell-active-page', 'false');
            pageA.setAttribute('data-app-shell-active-page', 'true');
            await settle();
            expect(directoryLabels()).toEqual(['#1 Question 1']);
            expect(toolbarCount(pageA)).toBe(1);
            expect(toolbarCount(pageB)).toBe(0);
            await settle();
            expect(toolbarCount(document)).toBe(1);
        } finally { orchestrator.dispose(); fixture.dispose(); }
    });

    it('shows an assistant-only visual response in Directory as soon as its completed body is captured', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = roundHtml(1);
        main.querySelector('[data-turn-id-container="user-slot-1"]')!.remove();
        main.querySelector('.markdown')!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="red"/></svg>';
        const fixture = createFixture();
        try {
            fixture.init();
            await settle();
            expect(fixture.counts()).toEqual({ mounted: 1, snapshot: 1, surface: 1, directory: 1 });
            const turn = fixture.runtime.source.read().snapshot?.turns[0]!;
            expect(turn.identity.userMessageId).toBeNull();
            expect(turn.assistantRichBlocks).toHaveLength(1);
            expect(turn.assistantMarkdown).toContain('aimd-rich:');
            const item = document.getElementById('aimd-chatgpt-directory-rail')!.shadowRoot!.querySelector<HTMLButtonElement>('.rail__item')!;
            expect(item.getAttribute('aria-label')).toContain('Diagram');
            expect(item.getAttribute('aria-label')).not.toContain('aimd-rich:');
        } finally { fixture.dispose(); }
    });

    it('admits the recorded native search-unit shape, deduplicates its assistant alias, and mounts the toolbar beside its ancestor action row', async () => {
        document.body.innerHTML = readFileSync(resolve(process.cwd(), 'tests/fixtures/chatgpt/native-search-unit-recorded-shape.html'), 'utf8');
        const fixture = createFixture();
        const orchestrator = new MessageToolbarOrchestrator(fixture.adapter, {
            readerPanel: new ReaderPanel(),
            conversationContentSource: fixture.runtime.source,
            conversationMaterialization: fixture.runtime.materialization,
            conversationSurface: fixture.runtime.surface,
        });
        orchestrator.setBehaviorFlags({ showWordCount: false, showSaveMessages: false });
        try {
            fixture.init();
            orchestrator.init();
            await settle();
            const assistant = document.querySelector<HTMLElement>('[data-chatgpt-search-unit-key$=":assistant"]')!;
            const row = document.querySelector<HTMLElement>('.turn-action-controls')!;
            expect(row.querySelector('button')?.getAttribute('aria-label')).toBe('Copy');
            expect(row.querySelector('button')?.hasAttribute('data-testid')).toBe(false);
            expect(fixture.adapter.getToolbarAnchorElement(assistant)).toBe(row);
            expect(fixture.runtime.source.read().snapshot?.turns).toHaveLength(1);
            const turn = fixture.runtime.source.read().snapshot!.turns[0]!;
            expect(turn.identity.assistantMessageId).toBe('assistant-native-1');
            expect(turn.identity.userMessageId).toBe('user-native-1');
            expect(turn.identity.turnId).not.toContain('fallback-turn-');
            expect(turn.assistantMarkdown).toContain('calculate_area');
            expect(fixture.runtime.surface.readFrame().obtainedTurns).toHaveLength(1);
            expect(document.getElementById('aimd-chatgpt-directory-rail')!.shadowRoot!.querySelectorAll('.rail__item')).toHaveLength(1);
            expect(row.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);

            const contentToken = fixture.runtime.source.read().snapshot!.contentToken;
            document.querySelector('[data-content-search-turn-key]')!.setAttribute('data-content-search-turn-key', 'fallback-turn-17');
            document.querySelectorAll('[data-chatgpt-search-unit-key]').forEach((node) => {
                node.setAttribute('data-chatgpt-search-unit-key', node.getAttribute('data-chatgpt-search-unit-key')!.replace('fallback-turn-0', 'fallback-turn-17'));
            });
            await settle();
            expect(fixture.runtime.source.read().snapshot?.contentToken).toBe(contentToken);
            expect(fixture.runtime.source.read().snapshot?.turns.map((item) => item.identity.assistantMessageId)).toEqual(['assistant-native-1']);
            expect(row.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
            expect(document.getElementById('aimd-chatgpt-directory-rail')!.shadowRoot!.querySelectorAll('.rail__item')).toHaveLength(1);
        } finally { orchestrator.dispose(); fixture.dispose(); }
    });

    it('keeps DOM-only history partial, then gives Directory all 24 obtained replies after a late source capture', async () => {
        const main = document.querySelector('main')!;
        main.innerHTML = Array.from({ length: 12 }, (_, index) => roundHtml(index + 13)).join('');
        const fixture = createFixture();
        try {
            fixture.init();
            await settle();
            expect(fixture.counts()).toEqual({ mounted: 12, snapshot: 12, surface: 12, directory: 12 });
            expect(fixture.runtime.source.read().snapshot?.historyStatus).toBe('partial');
            await settle(70_000);
            expect(fixture.counts()).toEqual({ mounted: 12, snapshot: 12, surface: 12, directory: 12 });
            expect(fixture.bridge).toHaveBeenCalledOnce();

            fixture.captureSource();
            await settle();
            expect(fixture.counts()).toEqual({ mounted: 12, snapshot: 24, surface: 24, directory: 24 });
            expect(fixture.runtime.source.read().snapshot?.historyStatus).toBe('get');
            expect(fixture.runtime.surface.readFrame().obtainedTurns.map(({ turn }) => turn.identity.assistantMessageId))
                .toEqual(Array.from({ length: 24 }, (_, index) => `assistant-${index + 1}`));
            expect(fixture.runtime.source.read().snapshot?.turns[12]?.assistantMarkdown).toBe('Answer 13');

            main.querySelectorAll('[data-turn]').forEach((node) => node.remove());
            await settle();
            expect(fixture.counts()).toEqual({ mounted: 0, snapshot: 24, surface: 24, directory: 24 });
            expect(fixture.bridge).toHaveBeenCalledTimes(2);
        } finally { fixture.dispose(); }
    });

    it.each(['exact', 'wrong'] as const)('checks an unmounted reply identity after a real directory click and %s host hydration', async (hydration) => {
        const main = document.querySelector('main')!;
        main.innerHTML = Array.from({ length: 24 }, (_, offset) => offset < 12 ? emptyRoundHtml(offset + 1) : roundHtml(offset + 1)).join('');
        // JSDOM supplies identity/DOM events; these dimensions model a scrollable host, not browser layout acceptance.
        main.style.overflowY = 'auto';
        Object.defineProperties(main, { clientHeight: { configurable: true, value: 600 }, scrollHeight: { configurable: true, value: 4800 } });
        main.getBoundingClientRect = () => ({ top: 0, bottom: 600, left: 0, right: 800, width: 800, height: 600, x: 0, y: 0, toJSON() {} });
        const scrolls: HTMLElement[] = [];
        const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value(this: HTMLElement) {
            if (!main.contains(this)) return;
            scrolls.push(this);
            if (this.getAttribute('data-turn-id-container') !== 'user-slot-4' || this.querySelector('[data-turn]')) return;
            const template = document.createElement('template');
            template.innerHTML = roundHtml(4);
            if (hydration === 'wrong') template.content.querySelector('[data-message-author-role="assistant"]')!.setAttribute('data-message-id', 'assistant-wrong');
            this.appendChild(template.content.querySelector('[data-turn="user"]')!);
            main.querySelector('[data-turn-id-container="assistant-slot-4"]')!.appendChild(template.content.querySelector('[data-turn="assistant"]')!);
        } });
        const fixture = createFixture(true);
        // JSDOM's fixture origin is not the production host; bind the real
        // conversation URL for the safe explicit fallback link.
        const readFrame = fixture.runtime.surface.readFrame.bind(fixture.runtime.surface);
        vi.spyOn(fixture.runtime.surface, 'readFrame').mockImplementation(() => {
            const frame = readFrame();
            return frame.document ? { ...frame, document: { ...frame.document, canonicalUrl: `https://chatgpt.com/c/${CONVERSATION_ID}` } } : frame;
        });
        try {
            fixture.init();
            await settle();
            expect(fixture.counts()).toEqual({ mounted: 12, snapshot: 24, surface: 24, directory: 24 });
            expect(fixture.runtime.surface.readFrame().obtainedTurns[3]?.materialization).toBeNull();
            const button = document.getElementById('aimd-chatgpt-directory-rail')!.shadowRoot!
                .querySelector<HTMLButtonElement>('.rail__item[data-position="4"]')!;
            expect(button.getAttribute('aria-label')).toBe('#4 Question 4');
            button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            button.click();
            await settle(hydration === 'exact' ? 2000 : 16_000);
            expect(fixture.navigate).toHaveBeenCalledOnce();
            const receipt = await fixture.navigate.mock.results[0]!.value;
            expect(fixture.navigate.mock.calls[0]?.[0]).toMatchObject({ position: 4, assistantMessageId: 'assistant-4', source: 'directory' });
            expect(scrolls.some((node) => node.getAttribute('data-turn-id-container') === 'user-slot-4')).toBe(true);
            if (hydration === 'exact') {
                expect(receipt).toMatchObject({ ok: true, resolvedBy: 'identity', target: { position: 4, assistantMessageId: 'assistant-4' } });
                const exact = fixture.runtime.surface.readFrame().obtainedTurns.find(({ turn }) => turn.identity.assistantMessageId === 'assistant-4')!;
                expect(exact.materialization?.messageElement.getAttribute('data-message-id')).toBe('assistant-4');
                expect(scrolls).toContain(exact.materialization?.jumpAnchorElement);
                expect(exact.materialization?.jumpAnchorElement.getBoundingClientRect().top).toBe(0);
            } else {
                expect(receipt).toEqual({ ok: false, reason: 'hydration-timeout' });
                const fallback = document.querySelector<HTMLAnchorElement>('#aimd-toast-viewport a')!;
                expect(new URL(fallback.href).searchParams.get('messageId')).toBe('assistant-4');
                expect(fallback.target).toBe('_blank');
                expect(fixture.runtime.surface.readFrame().obtainedTurns.find(({ turn }) => turn.identity.assistantMessageId === 'assistant-4')?.materialization).toBeNull();
            }
        } finally {
            fixture.dispose();
            if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
            else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
        }
    });
});
