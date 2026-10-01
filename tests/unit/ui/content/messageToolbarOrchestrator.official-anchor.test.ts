vi.mock('@/utils/toast',()=>({showToast:vi.fn()}));
import { showToast } from '@/utils/toast';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
vi.mock('@/drivers/content/clipboard/clipboard', () => ({ copyTextToClipboard: vi.fn(async () => true) }));
import { copyTextToClipboard } from '@/drivers/content/clipboard/clipboard';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConversationContentStateV1 } from '@/contracts/conversationContent';
import type { MessageMetadataSource } from '@/contracts/messageMetadata';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTConversationSurface } from '@/drivers/content/chatgpt/ChatGPTConversationSurface';
import { MessageToolbarOrchestrator } from '@/ui/content/controllers/MessageToolbarOrchestrator';
import { ChatGPTDirectoryRail } from '@/ui/content/chatgptDirectory/ChatGPTDirectoryRail';
import {
    createConversationContentSource,
    readyConversationState,
} from '../../../helpers/chatgptContentFixtures';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => true,
};

class FakeOfficialToolbarAdapter extends SiteAdapter {
    private streaming = false;

    matches(): boolean { return true; }
    getPlatformId(): string { return 'chatgpt'; }
    getThemeDetector(): ThemeDetector { return detector; }
    extractUserPrompt(): string | null { return 'Prompt'; }
    getMessageSelector(): string { return '.assistant-message'; }
    getMessageContentSelector(): string { return '.content'; }
    getActionBarSelector(): string { return '.official-toolbar'; }
    getToolbarAnchorElement(messageElement: HTMLElement): HTMLElement | null {
        const actionBar = messageElement.querySelector('.official-toolbar');
        return actionBar instanceof HTMLElement ? actionBar : null;
    }
    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const anchor = this.getToolbarAnchorElement(messageElement);
        if (!anchor) return false;
        anchor.appendChild(toolbarHost);
        return true;
    }
    isStreamingMessage(): boolean { return this.streaming; }
    getMessageId(messageElement: HTMLElement): string | null {
        return messageElement.getAttribute('data-message-id');
    }
    getObserverContainer(): HTMLElement | null { return document.body; }
    setStreaming(streaming: boolean): void { this.streaming = streaming; }
}

const SNAPSHOT = {
    conversationId: 'conv-1',
    revision: 1,
    rounds: [{
        id: 'round-1',
        position: 1,
        userPrompt: 'Prompt',
        assistantContent: 'First complete answer',
        preview: 'Prompt',
        messageId: 'm1',
        userMessageId: 'u1',
        assistantMessageId: 'm1',
    }],
};

const TWO_TURN_SNAPSHOT = {
    ...SNAPSHOT,
    revision: 2,
    rounds: [
        ...SNAPSHOT.rounds,
        {
            id: 'round-2',
            position: 2,
            userPrompt: 'Second prompt',
            assistantContent: 'Second complete answer',
            preview: 'Second prompt',
            messageId: 'm2',
            userMessageId: 'u2',
            assistantMessageId: 'm2',
        },
    ],
};

type Harness = {
    adapter: FakeOfficialToolbarAdapter;
    source: ReturnType<typeof createConversationContentSource>;
    surface: ChatGPTConversationSurface;
    orchestrator: MessageToolbarOrchestrator;
};

const harnesses = new Set<Harness>();

function renderTurn(options: { officialToolbar?: boolean; stopButton?: boolean } = {}): void {
    document.body.innerHTML = `
      <main>
        <article data-turn="user" data-turn-id="round-1">
          <div data-message-author-role="user" data-message-id="u1">Prompt</div>
        </article>
        <article data-turn="assistant" data-turn-id="assistant-turn-1">
          <div class="assistant-message" data-message-author-role="assistant" data-message-id="m1">
            <div class="content">First complete answer</div>
            ${options.officialToolbar === false ? '' : '<div class="official-toolbar"><button data-testid="copy-turn-action-button">Copy</button></div>'}
          </div>
        </article>
      </main>
      ${options.stopButton ? '<button data-testid="stop-button">Stop</button>' : ''}
    `;
}

function renderTwoTurns(): void {
    document.body.innerHTML = `
      <main>
        <article data-turn="user" data-turn-id="round-1">
          <div data-message-author-role="user" data-message-id="u1">First prompt</div>
        </article>
        <article data-turn="assistant" data-turn-id="assistant-turn-1">
          <div class="assistant-message" data-message-author-role="assistant" data-message-id="m1">
            <div class="content">First complete answer</div>
            <div class="official-toolbar"><button data-testid="copy-turn-action-button">Copy 1</button></div>
          </div>
        </article>
        <article data-turn="user" data-turn-id="round-2">
          <div data-message-author-role="user" data-message-id="u2">Second prompt</div>
        </article>
        <article data-turn="assistant" data-turn-id="assistant-turn-2">
          <div class="assistant-message" data-message-author-role="assistant" data-message-id="m2">
            <div class="content">Second complete answer</div>
            <div class="official-toolbar"><button data-testid="copy-turn-action-button">Copy 2</button></div>
          </div>
        </article>
      </main>
    `;
}

function createHarness(initial?: ConversationContentStateV1, messageMetadata?: MessageMetadataSource): Harness {
    const adapter = new FakeOfficialToolbarAdapter();
    const source = createConversationContentSource(initial ?? SNAPSHOT);
    const surface = new ChatGPTConversationSurface({ adapter, content: source });
    const orchestrator = new MessageToolbarOrchestrator(adapter, {
        readerPanel: { setTheme() {}, show: async () => undefined } as any,
        conversationContentSource: source,
        conversationMaterialization: surface.materialization,
        conversationSurface: surface,
        messageMetadata,
    });
    const harness = { adapter, source, surface, orchestrator };
    harnesses.add(harness);
    return harness;
}

function toolbarHosts(): NodeListOf<HTMLElement> {
    return document.querySelectorAll<HTMLElement>('[data-aimd-role="message-toolbar"]');
}

function clickPromptReplyHoverAction(): void {
    const shadow = toolbarHosts()[0].shadowRoot!;
    shadow.querySelector<HTMLButtonElement>('[data-action="toggle-capsule"]')!.click();
    expect(shadow.querySelector('[data-action="copy_prompt_reply"]')).toBeNull();
    shadow.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!.focus();
    const lower = document.querySelector('.aimd-toolbar-hover-action-host')!.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_prompt_reply"]')!;
    expect(lower.closest<HTMLElement>('[data-role="toolbar-hover-actions"]')!.dataset.placement).toBe('bottom');
    lower.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    lower.click();
}

describe('MessageToolbarOrchestrator Surface-driven official toolbar lifecycle', () => {
    it('copies the typed matching Prompt and reply through the actual toolbar trigger when the Prompt is offscreen', async () => {
        vi.mocked(copyTextToClipboard).mockClear();renderTurn();document.querySelector('[data-message-author-role="user"]')!.closest('article')!.remove();
        const {orchestrator,adapter}=createHarness();vi.spyOn(adapter,'getMarkdownParserAdapter').mockReturnValue(new ChatGPTAdapter().getMarkdownParserAdapter());orchestrator.init();await vi.waitFor(()=>expect(toolbarHosts()).toHaveLength(1));
        clickPromptReplyHoverAction();
        await vi.waitFor(()=>expect(copyTextToClipboard).toHaveBeenCalledOnce());expect(copyTextToClipboard).toHaveBeenCalledWith('## User Prompt\n\nPrompt\n\n## AI Reply\n\nFirst complete answer');
    });
    it('refuses to copy if the paired Prompt changes during preparation',async()=>{
        vi.mocked(copyTextToClipboard).mockClear();vi.mocked(showToast).mockClear();renderTurn();const {orchestrator,source}=createHarness();orchestrator.init();await vi.waitFor(()=>expect(toolbarHosts()).toHaveLength(1));
        let finish!:(item:unknown)=>void;vi.spyOn(orchestrator as any,'prepareCurrentReaderItemForElement').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
        clickPromptReplyHoverAction();
        source.publish({...SNAPSHOT,revision:2,rounds:[{...SNAPSHOT.rounds[0],userPrompt:'Edited prompt'}]});finish({id:'item',userPrompt:'Prompt',content:'First complete answer',meta:{assistantMessageId:'m1'}});
        await vi.waitFor(()=>expect(showToast).toHaveBeenCalledWith(expect.objectContaining({tone:'error'})));expect(copyTextToClipboard).not.toHaveBeenCalled();
    });
    it('refreshes mounted toolbars after visibility/pin settings change without hiding the official controls', async () => {
        renderTurn();const {orchestrator}=createHarness();orchestrator.init();await vi.waitFor(()=>expect(toolbarHosts()).toHaveLength(1));
        orchestrator.setBehaviorFlags({messageControls:{bookmark_toggle:true,copy_markdown:false,copy_prompt_reply:true,reader:true,export:true},pinnedMessageControls:['copy_prompt_reply'],showMessageTimestamp:false,showCopyPng:false});
        await vi.waitFor(()=>expect(toolbarHosts()).toHaveLength(1));const shadow=toolbarHosts()[0].shadowRoot!;expect(shadow.querySelector('[data-action="copy_markdown"]')).toBeNull();expect(shadow.querySelector('time')).toBeNull();expect(shadow.querySelector('[data-action="copy_prompt_reply"]')).toBeNull();expect(document.querySelector('[data-testid="copy-turn-action-button"]')).toBeTruthy();
    });

    afterEach(() => {
        for (const harness of harnesses) {
            harness.orchestrator.dispose();
            harness.surface.dispose();
            harness.adapter.dispose?.();
        }
        harnesses.clear();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    it('shows the website message time below character statistics without a year', async () => {
        renderTurn();
        let notifyMetadataChanged = () => undefined;
        const messageMetadata: MessageMetadataSource = {
            read: vi.fn((conversationId, messageId) => conversationId === 'conv-1' && messageId === 'm1'
                ? { createdAt: new Date('2023-11-14T06:13:00Z').getTime() }
                : null),
            subscribe: (listener) => {
                notifyMetadataChanged = listener;
                return () => undefined;
            },
        };
        const { adapter, orchestrator } = createHarness(undefined, messageMetadata);
        orchestrator.init();

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        const shadow = toolbarHosts()[0]!.shadowRoot!;
        const stats = shadow.querySelector<HTMLElement>('[data-role="stats"]');
        const time = shadow.querySelector<HTMLTimeElement>('[data-role="message-time"]');
        expect(stats?.textContent).toBeTruthy();
        expect(time?.hidden).toBe(false);
        expect(time?.dateTime).toBe('2023-11-14T06:13:00.000Z');
        expect(time?.textContent).not.toContain('2023');
        expect(stats?.parentElement).toBe(time?.parentElement);
        expect(messageMetadata.read).toHaveBeenCalledWith('conv-1', 'm1');

        vi.mocked(messageMetadata.read).mockClear();
        vi.spyOn(adapter, 'getMessageId').mockReturnValue('local-fallback');
        notifyMetadataChanged();
        expect(messageMetadata.read).toHaveBeenCalledWith('conv-1', 'm1');
        expect(messageMetadata.read).not.toHaveBeenCalledWith('conv-1', 'local-fallback');
    });

    it('keeps every official message toolbar when optional time reading fails', async () => {
        renderTwoTurns();
        const messageMetadata: MessageMetadataSource = {
            read: () => { throw new Error('Time unavailable'); },
            subscribe: () => () => undefined,
        };
        const { orchestrator } = createHarness(TWO_TURN_SNAPSHOT, messageMetadata);
        orchestrator.init();

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(2));
        for (const host of toolbarHosts()) {
            expect(host.shadowRoot?.querySelector('[data-action="toggle-capsule"]')).not.toBeNull();
            expect(host.shadowRoot?.querySelector<HTMLTimeElement>('time')?.hidden).toBe(true);
        }
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(2);
    });

    it('keeps the toolbar lifecycle running when optional time subscription fails', async () => {
        renderTurn();
        const { orchestrator } = createHarness(undefined, {
            read: () => null,
            subscribe: () => { throw new Error('Time subscription unavailable'); },
        });
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        expect(toolbarHosts()[0]?.shadowRoot?.querySelector('[data-action="toggle-capsule"]')).not.toBeNull();
    });

    it('waits for the official action row and injects once when PageIndex observes it', async () => {
        renderTurn({ officialToolbar: false });
        const { orchestrator } = createHarness();
        orchestrator.init();

        expect(toolbarHosts()).toHaveLength(0);

        const message = document.querySelector('.assistant-message');
        if (!(message instanceof HTMLElement)) throw new Error('assistant fixture is missing');
        message.insertAdjacentHTML(
            'beforeend',
            '<div class="official-toolbar"><button data-testid="copy-turn-action-button">Copy</button></div>',
        );

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
    });

    it('injects for a completed mounted message before Repository publication', async () => {
        renderTurn();
        const documentRef = readyConversationState(SNAPSHOT).document;
        const harness = createHarness({
            kind: 'syncing',
            document: documentRef,
            snapshot: null,
        });
        harness.adapter.setStreaming(false);

        harness.orchestrator.init();

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        expect(document.querySelector('[data-testid="copy-turn-action-button"]')).toBeTruthy();
    });

    it('removes only extension UI when the toolbar feature is disabled', async () => {
        renderTurn();
        const { orchestrator } = createHarness();
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));

        orchestrator.setBehaviorFlags({ showMessageToolbar: false });

        expect(toolbarHosts()).toHaveLength(0);
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
        expect(document.querySelector('.official-toolbar')).toBeTruthy();
    });

    it('shows only Export in the directory preview for an unmounted canonical turn', async () => {
        renderTurn();
        const adapter = new FakeOfficialToolbarAdapter();
        const source = createConversationContentSource(readyConversationState(TWO_TURN_SNAPSHOT));
        const surface = new ChatGPTConversationSurface({ adapter, content: source });
        const readerPanel = {
            setTheme() {},
            show: vi.fn(async () => undefined),
        };
        const saveMessagesDialog = {
            open: vi.fn(async () => true),
            isOpen: () => false,
            close: vi.fn(),
            setAppearance() {},
            setExportSettings() {},
            setMarkdownFormulaFormat() {},
        } as any;
        const orchestrator = new MessageToolbarOrchestrator(adapter, {
            readerPanel: readerPanel as any,
            saveMessagesDialog,
            conversationContentSource: source,
            conversationMaterialization: surface.materialization,
            conversationSurface: surface,
        });
        harnesses.add({ adapter, source, surface, orchestrator });

        const actions = orchestrator.getDirectoryPreviewActions(TWO_TURN_SNAPSHOT.rounds[1]!);
        expect(actions.map((action) => action.id)).toEqual(['export']);
        const rail = new ChatGPTDirectoryRail('light', () => undefined);
        rail.setPreviewActionsFactory((round) => orchestrator.getDirectoryPreviewActions(round));
        rail.setRounds(TWO_TURN_SNAPSHOT.rounds);
        rail.getElement().shadowRoot?.querySelector<HTMLElement>('.rail__item[data-position="2"]')
            ?.dispatchEvent(new Event('pointerover', { bubbles: true }));
        const preview = document.getElementById('aimd-chatgpt-directory-preview');
        const previewToolbar = preview?.querySelector<HTMLElement>('.aimd-message-toolbar-host')?.shadowRoot;
        expect(previewToolbar?.querySelector('[data-action="reader"]')).toBeNull();
        const exportButton = previewToolbar?.querySelector<HTMLButtonElement>('[data-action="export"]');
        expect(exportButton).toBeTruthy();
        exportButton?.click();
        await vi.waitFor(() => expect(saveMessagesDialog.open).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(String),
            expect.objectContaining({
                conversationTarget: expect.objectContaining({ assistantMessageId: 'm2' }),
                currentReaderItem: expect.objectContaining({ meta: expect.objectContaining({ position: 2 }) }),
            }),
        ));
        expect(readerPanel.show).not.toHaveBeenCalled();
        rail.dispose();
    });

    it('repairs a removed extension host through the shared PageIndex without duplicating it', async () => {
        renderTurn();
        const { orchestrator } = createHarness();
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));

        toolbarHosts()[0]?.remove();

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
    });

    it('follows an official action-row replacement and never removes host controls', async () => {
        renderTurn();
        const { orchestrator } = createHarness();
        orchestrator.init();
        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));

        const previous = document.querySelector('.official-toolbar');
        if (!(previous instanceof HTMLElement)) throw new Error('official toolbar fixture is missing');
        const replacement = document.createElement('div');
        replacement.className = 'official-toolbar';
        replacement.innerHTML = '<button data-testid="copy-turn-action-button">Copy replacement</button>';
        previous.replaceWith(replacement);

        await vi.waitFor(() => {
            expect(replacement.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        });
        expect(toolbarHosts()).toHaveLength(1);
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(1);
    });

    it('keeps one toolbar per stable assistant identity across multi-message remounts', async () => {
        renderTwoTurns();
        const { orchestrator } = createHarness(TWO_TURN_SNAPSHOT);
        orchestrator.init();

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(2));
        for (const message of Array.from(document.querySelectorAll<HTMLElement>('.assistant-message'))) {
            expect(message.querySelectorAll('[data-aimd-role="message-toolbar"]')).toHaveLength(1);
        }

        const previous = document.querySelector<HTMLElement>('[data-message-id="m2"]');
        if (!previous) throw new Error('second assistant fixture is missing');
        const replacement = previous.cloneNode(true) as HTMLElement;
        replacement.querySelector('[data-aimd-role="message-toolbar"]')?.remove();
        previous.replaceWith(replacement);

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(2));
        expect(document.querySelectorAll<HTMLElement>('[data-message-id="m2"] [data-aimd-role="message-toolbar"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-testid="copy-turn-action-button"]')).toHaveLength(2);
    });

    it('keeps official controls untouched while content is pending, then upgrades from the pool', async () => {
        renderTurn({ stopButton: true });
        const documentRef = readyConversationState(SNAPSHOT).document;
        const syncing: ConversationContentStateV1 = {
            kind: 'syncing',
            document: documentRef,
            snapshot: null,
        };
        const harness = createHarness(syncing);
        harness.adapter.setStreaming(true);
        harness.orchestrator.init();

        expect(toolbarHosts()).toHaveLength(0);
        expect(document.querySelector('[data-testid="stop-button"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="copy-turn-action-button"]')).toBeTruthy();

        harness.adapter.setStreaming(false);
        harness.source.publish(SNAPSHOT);

        await vi.waitFor(() => expect(toolbarHosts()).toHaveLength(1));
        const stats = toolbarHosts()[0]?.shadowRoot
            ?.querySelector<HTMLElement>('[data-role="stats"]')
            ?.textContent?.trim();
        expect(stats).toBeTruthy();
        expect(stats).not.toContain('—');
        expect(document.querySelector('[data-testid="stop-button"]')).toBeTruthy();
        expect(document.querySelector('[data-testid="copy-turn-action-button"]')).toBeTruthy();
    });
});

it('copies raw reply links through the actual Prompt+Reply trigger when link preservation is enabled',async()=>{
    vi.mocked(copyTextToClipboard).mockClear();renderTurn();document.querySelector('.content')!.innerHTML='<p>Visit <a href="https://example.com">Example</a>.</p>';
    const {orchestrator,adapter}=createHarness();vi.spyOn(adapter,'getMarkdownParserAdapter').mockReturnValue(new ChatGPTAdapter().getMarkdownParserAdapter());orchestrator.setContentCleanupSettings({preserveLinks:true,includeCodeBlocks:true});orchestrator.init();await vi.waitFor(()=>expect(toolbarHosts()).toHaveLength(1));clickPromptReplyHoverAction();await vi.waitFor(()=>expect(copyTextToClipboard).toHaveBeenCalledOnce());expect(vi.mocked(copyTextToClipboard).mock.calls[0][0]).toContain('[Example](https://example.com)');
});
