import '../browserExtensionMock';

import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

type ActiveSurface = 'bookmark' | 'export' | 'send' | null;

const browserApi = (globalThis as typeof globalThis & {
    browser: { runtime: { sendMessage: (request: unknown) => Promise<unknown> } };
}).browser;

browserApi.runtime.sendMessage = async (request: unknown) => {
    const envelope = request as { id?: string; type?: string; payload?: { value?: string | null } };
    const response = (data: unknown) => ({
        v: 1,
        id: envelope.id ?? 'visual-fixture',
        type: envelope.type,
        ok: true,
        data,
    });
    if (envelope.type === 'bookmarks:folders:list') {
        const now = Date.now();
        const folders = [
            { path: 'Inbox', name: 'Inbox', depth: 1, createdAt: now, updatedAt: now },
            { path: 'Projects', name: 'Projects', depth: 1, createdAt: now, updatedAt: now },
            { path: 'Projects/Research', name: 'Research', depth: 2, createdAt: now, updatedAt: now },
            { path: 'Archive', name: 'Archive', depth: 1, createdAt: now, updatedAt: now },
        ];
        return response({ folders, folderPaths: folders.map((folder) => folder.path) });
    }
    if (envelope.type === 'bookmarks:uiState:get') return response({ value: 'Projects/Research' });
    if (envelope.type === 'bookmarks:uiState:set') return response({ value: envelope.payload?.value ?? null });
    return response({});
};

const [
    { BookmarkSaveDialog },
    { SaveMessagesDialog },
    { SendPopover },
    { getTokenCss },
    { getPanelChromeCss },
    { setLocale },
] = await Promise.all([
    import('../../../src/ui/content/bookmarks/save/BookmarkSaveDialog'),
    import('../../../src/ui/content/export/SaveMessagesDialog'),
    import('../../../src/ui/content/sending/SendPopover'),
    import('../../../src/style/tokens'),
    import('../../../src/ui/content/components/styles/panelChromeCss'),
    import('../../../src/ui/content/components/i18n'),
]);

const bookmarkDialog = new BookmarkSaveDialog();
const exportDialog = new SaveMessagesDialog();
const sendPopover = new SendPopover();
const conversation = document.querySelector<HTMLElement>('[data-role="mock-conversation"]')!;
const sendHost = document.querySelector<HTMLElement>('[data-role="send-shadow-host"]')!;
const sendShadow = sendHost.attachShadow({ mode: 'open' });
let activeSurface: ActiveSurface = null;
let activeVariant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

const turns = Array.from({ length: 18 }, (_, index) => {
    const turn = document.createElement('article');
    turn.className = 'mock-turn';
    const user = document.createElement('div');
    user.className = 'mock-user';
    user.textContent = `Question ${index + 1}`;
    const assistant = document.createElement('div');
    assistant.className = 'mock-assistant';
    assistant.dataset.id = `assistant-${index + 1}`;
    assistant.dataset.prompt = user.textContent;
    const content = document.createElement('div');
    content.className = 'mock-content';
    content.textContent = `Answer ${index + 1}`;
    assistant.appendChild(content);
    turn.append(user, assistant);
    conversation.appendChild(turn);
    return { turn, user, assistant, content };
});

const adapter = {
    matches: () => true,
    getPlatformId: () => 'mock',
    getThemeDetector: () => ({
        detect: () => activeVariant.theme,
        getObserveTargets: () => [],
        hasExplicitTheme: () => true,
    }),
    extractUserPrompt: (message: HTMLElement) => message.dataset.prompt ?? null,
    getMessageSelector: () => '.mock-assistant',
    getMessageContentSelector: () => '.mock-content',
    getActionBarSelector: () => '.mock-action-row',
    getToolbarAnchorElement: () => null,
    getConversationGroupRefs: () => turns.map(({ turn, user, assistant, content }, index) => ({
        id: `turn-${index + 1}`,
        assistantRootEl: turn,
        assistantMessageEl: assistant,
        assistantContentRootEl: content,
        userRootEl: user,
        userPromptText: user.textContent,
        groupEls: [turn],
        assistantIndex: index,
        isStreaming: false,
    })),
    isStreamingMessage: () => false,
    getMessageId: (message: HTMLElement) => message.dataset.id ?? null,
    getObserverContainer: () => conversation,
    getLastMessageElement: () => turns.at(-1)?.assistant ?? null,
    getMarkdownParserAdapter: () => null,
    normalizeDOM: () => undefined,
    cleanMarkdown: (markdown: string) => markdown,
    isNoiseNode: () => false,
    getArtifactPlaceholder: () => null,
    shouldEnhanceUnrenderedMath: () => false,
    getComposerInputElement: () => null,
    getComposerSendButtonElement: () => null,
} as any;

function mountSendStage(theme: 'light' | 'dark'): HTMLElement {
    sendShadow.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `
${getTokenCss(theme)}
${getPanelChromeCss()}
:host { position: fixed; inset: 0; pointer-events: none; font-family: var(--aimd-font-family-sans); }
*, *::before, *::after { box-sizing: border-box; }
.panel-window--reader {
  position: fixed;
  inset: auto auto var(--aimd-space-5) 50%;
  width: min(760px, calc(100vw - var(--aimd-space-4) * 2));
  height: min(540px, calc(100vh - var(--aimd-space-4) * 2));
  transform: translateX(-50%);
  pointer-events: auto;
}
.reader-body { flex: 1 1 auto; min-height: 0; padding: var(--aimd-space-5); overflow: auto; }
.reader-footer__left { position: relative; display: flex; padding: var(--aimd-space-4); border-top: 1px solid var(--aimd-border-default); }
`;
    const panel = document.createElement('section');
    panel.className = 'panel-window panel-window--reader';
    panel.innerHTML = `
      <div class="panel-header"><div class="panel-header__meta"><h2>Reader</h2></div></div>
      <div class="reader-body">A compact Reader host keeps the real Send popover anchored to its production context.</div>
      <div class="reader-footer__left"><button class="secondary-btn" type="button" data-action="send-anchor">Send</button></div>
    `;
    sendShadow.append(style, panel);
    return panel.querySelector<HTMLElement>('.reader-footer__left')!;
}

function nextTask(): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function waitForHost(id: string): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const host = document.getElementById(id);
        if (host) return host;
        await nextTask();
    }
    throw new Error(`Workflow fixture host did not mount: ${id}`);
}

async function waitForHostRemoval(id: string): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (!document.getElementById(id)) return;
        await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
    throw new Error(`Workflow fixture host did not close: ${id}`);
}

async function closeActiveSurface(): Promise<void> {
    const bookmarkHost = document.getElementById('aimd-bookmark-save-dialog-host');
    const exportHost = document.getElementById('aimd-save-messages-dialog-host');

    bookmarkHost?.removeAttribute('data-aimd-role');
    exportHost?.removeAttribute('data-aimd-role');
    sendHost.removeAttribute('data-aimd-role');

    bookmarkHost
        ?.shadowRoot
        ?.querySelector<HTMLButtonElement>('[data-action="close-panel"]')
        ?.click();
    if (exportHost) exportDialog.close();
    if (sendShadow.querySelector('.send-popover')) sendPopover.close(sendShadow, { syncBack: false });
    sendShadow.replaceChildren();
    activeSurface = null;

    await Promise.all([
        bookmarkHost ? waitForHostRemoval(bookmarkHost.id) : Promise.resolve(),
        exportHost ? waitForHostRemoval(exportHost.id) : Promise.resolve(),
    ]);
}

async function openBookmark(): Promise<void> {
    activeSurface = 'bookmark';
    void bookmarkDialog.open({
        theme: activeVariant.theme,
        userPrompt: activeVariant.locale === 'zh_CN'
            ? '整理关于可复用界面架构的长标题与研究笔记'
            : 'Organize a long research note about reusable interface architecture',
        currentFolderPath: 'Projects/Research',
    });
    const host = await waitForHost('aimd-bookmark-save-dialog-host');
    host.setAttribute('data-aimd-role', 'workflow-dialog');
}

async function openExport(): Promise<void> {
    activeSurface = 'export';
    await exportDialog.open(adapter, activeVariant.theme);
    const host = await waitForHost('aimd-save-messages-dialog-host');
    host.setAttribute('data-aimd-role', 'workflow-dialog');
}

function openSend(): void {
    activeSurface = 'send';
    const anchor = mountSendStage(activeVariant.theme);
    sendPopover.open({
        shadow: sendShadow,
        anchor,
        sendPort: {
            readDraft: () => '',
            writeDraft: () => undefined,
            submit: async () => ({ ok: true }),
        },
        theme: activeVariant.theme,
        initialText: activeVariant.locale === 'zh_CN'
            ? '请根据这些批注整理一份清晰、精简且可执行的回复。'
            : 'Turn these annotations into a concise and actionable response.',
    });
    sendHost.setAttribute('data-aimd-role', 'workflow-dialog');
}

document.querySelector<HTMLButtonElement>('[data-action="open-bookmark"]')?.addEventListener('click', () => void openBookmark());
document.querySelector<HTMLButtonElement>('[data-action="open-export"]')?.addEventListener('click', () => void openExport());
document.querySelector<HTMLButtonElement>('[data-action="open-send"]')?.addEventListener('click', () => openSend());

function localizeFixture(locale: VisualHarnessVariant['locale']): void {
    const zh = locale === 'zh_CN';
    document.querySelector<HTMLElement>('[data-role="fixture-title"]')!.textContent = zh ? '工作流对话框入口' : 'Workflow dialog launcher';
    document.querySelector<HTMLElement>('[data-role="fixture-description"]')!.textContent = zh
        ? '通过真实用户入口打开生产模块。'
        : 'Real production modules opened through their user-facing controls.';
    document.querySelector<HTMLButtonElement>('[data-action="open-bookmark"]')!.textContent = zh ? '保存书签' : 'Bookmark Save';
    document.querySelector<HTMLButtonElement>('[data-action="open-export"]')!.textContent = zh ? '保存消息' : 'Save Messages';
    document.querySelector<HTMLButtonElement>('[data-action="open-send"]')!.textContent = zh ? '发送' : 'Send';
}

installVisualHarnessBridge({
    applyVariant: async (variant) => {
        await closeActiveSurface();
        activeVariant = variant;
        document.documentElement.dataset.aimdTheme = variant.theme;
        document.documentElement.lang = variant.locale === 'zh_CN' ? 'zh-CN' : 'en';
        document.body.dataset.theme = variant.theme;
        localizeFixture(variant.locale);
        await setLocale(variant.locale);

        if (variant.theme === 'dark') {
            document.querySelector<HTMLButtonElement>('[data-action="open-send"]')?.click();
        } else if (variant.locale === 'zh_CN') {
            document.querySelector<HTMLButtonElement>('[data-action="open-export"]')?.click();
            await waitForHost('aimd-save-messages-dialog-host');
        } else {
            document.querySelector<HTMLButtonElement>('[data-action="open-bookmark"]')?.click();
            await waitForHost('aimd-bookmark-save-dialog-host');
        }
    },
    prepareForAudit: async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 40));
    },
    getState: () => {
        const bookmarkRoot = document.getElementById('aimd-bookmark-save-dialog-host')?.shadowRoot;
        const exportRoot = document.getElementById('aimd-save-messages-dialog-host')?.shadowRoot;
        const localeEvidence = bookmarkRoot?.textContent
            ?? exportRoot?.textContent
            ?? sendShadow.textContent
            ?? document.body.textContent
            ?? '';
        return {
            ...activeVariant,
            expectedOpenSurfaces: [{ role: 'workflow-dialog', count: activeSurface ? 1 : 0 }],
            localeEvidence,
        };
    },
});
