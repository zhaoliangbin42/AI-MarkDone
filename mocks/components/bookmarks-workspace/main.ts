import '../browserExtensionMock';

import { DEFAULT_SETTINGS } from '../../../src/core/settings/types';
import type { Bookmark, Folder } from '../../../src/core/bookmarks/types';
import type { SiteAdapter } from '../../../src/drivers/content/adapters/base';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { BookmarksPanel } from '../../../src/ui/content/bookmarks/BookmarksPanel';
import { BookmarksPanelController } from '../../../src/ui/content/bookmarks/BookmarksPanelController';
import { setLocale } from '../../../src/ui/content/components/i18n';
import { ChatGPTMessageStepperController } from '../../../src/ui/content/controllers/ChatGPTMessageStepperController';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

history.replaceState({}, '', '/c/12345678-abcd-4abc-8def-1234567890ab');

const now = Date.now();
const folders: Folder[] = [
    { path: 'Projects', name: 'Projects', depth: 0, createdAt: now - 30_000, updatedAt: now },
    { path: 'Projects/Research', name: 'Research', depth: 1, createdAt: now - 20_000, updatedAt: now },
    { path: 'Reference', name: 'Reference', depth: 0, createdAt: now - 10_000, updatedAt: now },
];
const bookmarks: Bookmark[] = [
    {
        kind: 'page',
        url: 'https://chatgpt.com/c/12345678-abcd-4abc-8def-1234567890ab',
        urlWithoutProtocol: 'chatgpt.com/c/12345678-abcd-4abc-8def-1234567890ab',
        pageKey: 'fixture-page',
        timestamp: now,
        title: 'Reusable interface architecture and responsive workspace notes',
        platform: 'ChatGPT',
        folderPath: 'Projects/Research',
    },
    ...Array.from({ length: 7 }, (_, index): Bookmark => ({
        kind: 'message',
        url: 'https://chatgpt.com/c/12345678-abcd-4abc-8def-1234567890ab',
        urlWithoutProtocol: 'chatgpt.com/c/12345678-abcd-4abc-8def-1234567890ab',
        position: index + 1,
        messageId: `assistant-${index + 1}`,
        userMessage: `Research question ${index + 1}`,
        aiResponse: `A concise research answer for bookmark ${index + 1}.`,
        timestamp: now - index * 60_000,
        title: index % 2 === 0
            ? `A deliberately long bookmark title that verifies compact workspace wrapping ${index + 1}`
            : `Bookmark ${index + 1}`,
        platform: 'ChatGPT',
        folderPath: index < 4 ? 'Projects/Research' : 'Reference',
    })),
];

const browserApi = (globalThis as typeof globalThis & { browser: any }).browser;
browserApi.runtime.sendMessage = async (request: { v: number; id: string; type: string }) => {
    let data: unknown = {};
    switch (request.type) {
        case 'settings:getAll':
            data = { settings: structuredClone(DEFAULT_SETTINGS) };
            break;
        case 'settings:setCategory':
            data = { category: 'appearance' };
            break;
        case 'bookmarks:list':
            data = { bookmarks };
            break;
        case 'bookmarks:folders:list':
            data = { folders, folderPaths: folders.map(({ path }) => path) };
            break;
        case 'bookmarks:storageUsage':
            data = { bytesInUse: 42_000, quotaBytes: 100_000, usedPercentage: 42 };
            break;
        case 'bookmarks:positions':
            data = { positions: [1, 3, 6] };
            break;
        case 'bookmarks:page:status':
            data = { saved: true };
            break;
        case 'bookmarks:uiState:get':
            data = { value: 'Projects/Research' };
            break;
        case 'bookmarks:changelogNotice:get':
            data = { pendingVersion: null, lastShownVersion: null, reason: null, previousVersion: null };
            break;
        case 'cloudBackup:status':
            data = {
                configured: true,
                connected: true,
                accountDisplayName: 'Workspace owner',
                accountEmail: 'workspace@example.com',
                lastBackupAt: new Date(now).toISOString(),
            };
            break;
        default:
            data = {};
    }
    return { v: request.v, id: request.id, type: request.type, ok: true, data };
};

const conversationRoot = document.querySelector<HTMLElement>('[data-role="conversation-root"]')!;
const user = conversationRoot.querySelector<HTMLElement>('.user-message')!;
const assistant = conversationRoot.querySelector<HTMLElement>('.assistant-message')!;
const content = conversationRoot.querySelector<HTMLElement>('.assistant-content')!;

const adapter = {
    matches: () => true,
    getPlatformId: () => 'chatgpt',
    getThemeDetector: () => ({
        detect: () => 'light' as const,
        getObserveTargets: () => [],
        hasExplicitTheme: () => true,
    }),
    extractUserPrompt: () => user.textContent,
    getMessageSelector: () => '.assistant-message',
    getMessageContentSelector: () => '.assistant-content',
    getActionBarSelector: () => '.official-actions',
    getToolbarAnchorElement: () => null,
    isStreamingMessage: () => false,
    getMessageId: () => 'assistant-1',
    getObserverContainer: () => conversationRoot,
    getConversationGroupRefs: () => [{
        id: 'turn-1',
        assistantRootEl: assistant,
        assistantMessageEl: assistant,
        assistantContentRootEl: content,
        userRootEl: user,
        userPromptText: user.textContent,
        userPromptQuality: 'real',
        barAnchorEl: user,
        groupEls: [user, assistant],
        assistantIndex: 0,
        isStreaming: false,
    }],
} as unknown as SiteAdapter;

const controller = new BookmarksPanelController(adapter);
const panel = new BookmarksPanel(controller, { show: async () => undefined, hide: () => undefined });
let stepper: ChatGPTMessageStepperController | null = null;
let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

const nextTask = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

async function waitForPanel(): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const host = document.getElementById('aimd-bookmarks-panel-host');
        if (host?.shadowRoot?.querySelector('.aimd-panel')) return host;
        await nextTask();
    }
    throw new Error('Bookmarks workspace fixture did not mount the production panel.');
}

async function closePanel(): Promise<void> {
    const host = document.getElementById('aimd-bookmarks-panel-host');
    if (!host) return;
    host.removeAttribute('data-aimd-role');
    panel.hide();
    host.shadowRoot?.querySelector<HTMLElement>('.aimd-panel')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await nextTask();
}

async function openFromPageControl(): Promise<HTMLElement> {
    const button = document.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]');
    if (!button) throw new Error('Production Bookmarks page-control trigger is unavailable.');
    button.click();
    const host = await waitForPanel();
    host.setAttribute('data-aimd-role', 'bookmarks-workspace');
    return host;
}

async function showSettingsAndCloudBackup(host: HTMLElement): Promise<void> {
    const shadow = host.shadowRoot!;
    shadow.querySelector<HTMLButtonElement>('.tab-btn[data-tab-id="settings"]')?.click();
    await nextTask();
    const cloudBackup = shadow.querySelector<HTMLElement>('[data-role="settings-google-drive-backup-card"]');
    cloudBackup?.scrollIntoView({ block: 'center' });
}

async function showInfoTab(host: HTMLElement, tabId: 'about' | 'feedback' | 'mappamory'): Promise<void> {
    const shadow = host.shadowRoot!;
    shadow.querySelector<HTMLButtonElement>(`.tab-btn[data-tab-id="${tabId}"]`)?.click();
    await nextTask();
    const panel = shadow.querySelector<HTMLElement>(`.${tabId}-panel`);
    if (tabId === 'feedback') {
        panel?.querySelector<HTMLElement>('.community-card')?.scrollIntoView({ block: 'start' });
    } else {
        panel?.scrollTo({ top: 0 });
    }
}

async function applyVariant(next: VisualHarnessVariant): Promise<void> {
    await closePanel();
    stepper?.dispose();
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.documentElement.lang = next.locale === 'zh_CN' ? 'zh-CN' : 'en';
    document.body.dataset.theme = next.theme;
    await setLocale(next.locale);

    const zh = next.locale === 'zh_CN';
    document.querySelector<HTMLElement>('[data-role="fixture-title"]')!.textContent = zh
        ? '书签工作区入口'
        : 'Bookmarks workspace entry';
    document.querySelector<HTMLElement>('[data-role="fixture-description"]')!.textContent = zh
        ? '真实页面控制按钮会打开生产环境中的书签面板。'
        : 'The real page control opens the production Bookmarks panel.';

    controller.setAppearance(createAppearanceSnapshot(next.theme));
    stepper = new ChatGPTMessageStepperController(adapter, {
        onOpenBookmarksPanel: () => panel.toggle(),
        onTogglePageBookmark: () => ({ saved: true }),
        onRefreshPageBookmarkState: () => true,
    });
    stepper.init();
    stepper.setAppearance(createAppearanceSnapshot(next.theme));
    stepper.setPageBookmarked(true);

    const host = await openFromPageControl();
    if (window.innerWidth >= 1200) {
        await showInfoTab(host, next.theme === 'light' ? 'feedback' : 'mappamory');
    } else if (next.locale === 'zh_CN') {
        await showInfoTab(host, next.theme === 'light' ? 'feedback' : 'mappamory');
    } else if (next.theme === 'dark') {
        await showSettingsAndCloudBackup(host);
    }
}

await applyVariant(variant);

installVisualHarnessBridge({
    applyVariant,
    prepareForAudit: async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    },
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [{ role: 'bookmarks-workspace', count: 1 }],
        localeEvidence: document.getElementById('aimd-bookmarks-panel-host')?.shadowRoot?.textContent
            ?? document.body.textContent
            ?? '',
    }),
});

window.addEventListener('pagehide', () => {
    stepper?.dispose();
    panel.hide();
}, { once: true });
