import '../browserExtensionMock';

import { InputEnhancementPopover } from '../../../src/ui/content/components/InputEnhancementPopover';
import { Icons } from '../../../src/assets/icons';
import type { ConversationGroupRef, SiteAdapter } from '../../../src/drivers/content/adapters/base';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { AppearanceScope } from '../../../src/style/appearanceScope';
import { ensurePageTokens } from '../../../src/style/pageTokens';
import { ensureStyle } from '../../../src/style/shadow';
import { showToast } from '../../../src/utils/toast';
import { MessageToolbar } from '../../../src/ui/content/MessageToolbar';
import { ChatGPTDirectoryRail } from '../../../src/ui/content/chatgptDirectory/ChatGPTDirectoryRail';
import { TaskProgressPanel } from '../../../src/ui/content/components/TaskProgressPanel';
import { setLocale } from '../../../src/ui/content/components/i18n';
import { ChatGPTMessageStepperController } from '../../../src/ui/content/controllers/ChatGPTMessageStepperController';
import type { ConversationSurfaceFrameV1, ConversationSurfacePortV1 } from '../../../src/contracts/conversationSurface';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

ensurePageTokens();
history.replaceState({}, '', '/c/12345678-abcd-4abc-8def-1234567890ab');

const copy = {
    en: {
        title: 'Host-integrated controls',
        description: 'Real toolbar, transient progress, page controls, and conversation directory modules.',
        copy: 'Copy Markdown',
        copyPng: 'Copy as PNG',
        bookmark: 'Bookmark',
        progress: 'Rendering image · 3 of 5',
        toast: 'Markdown copied',
    },
    zh_CN: {
        title: '宿主集成控件',
        description: '真实工具栏、临时进度、页面控制和会话目录模块。',
        copy: '复制 Markdown',
        copyPng: '复制为 PNG',
        bookmark: '收藏',
        progress: '正在渲染图片 · 3 / 5',
        toast: '已复制 Markdown',
    },
} as const;

const conversationRoot = document.querySelector<HTMLElement>('[data-role="conversation-root"]')!;
const turnElements = Array.from(conversationRoot.querySelectorAll<HTMLElement>('.turn'));
const groups: ConversationGroupRef[] = turnElements.map((turn, index) => {
    const user = turn.querySelector<HTMLElement>('[data-message-author-role="user"]')!;
    const assistant = turn.querySelector<HTMLElement>('.assistant-message')!;
    const content = assistant.querySelector<HTMLElement>('.assistant-content')!;
    return {
        id: `turn-${index + 1}`,
        assistantRootEl: assistant,
        assistantMessageEl: assistant,
        assistantContentRootEl: content,
        userRootEl: user,
        userPromptText: user.textContent,
        userPromptQuality: 'real',
        barAnchorEl: user,
        groupEls: [user, assistant],
        assistantIndex: index,
        isStreaming: false,
    };
});

const adapter = {
    matches: () => true,
    getPlatformId: () => 'chatgpt',
    getThemeDetector: () => ({
        detect: () => 'light' as const,
        getObserveTargets: () => [],
        hasExplicitTheme: () => true,
    }),
    extractUserPrompt: (message: HTMLElement) => message.closest('.turn')?.querySelector('.user-message')?.textContent ?? null,
    getMessageSelector: () => '.assistant-message',
    getMessageContentSelector: () => '.assistant-content',
    getActionBarSelector: () => '.official-actions',
    getToolbarAnchorElement: (message: HTMLElement) => message.querySelector<HTMLElement>('.official-actions'),
    isStreamingMessage: () => false,
    getMessageId: (message: HTMLElement) => message.dataset.messageId ?? null,
    getObserverContainer: () => conversationRoot,
    getConversationGroupRefs: () => groups,
} as unknown as SiteAdapter;

let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };
let toolbar: MessageToolbar;
let directory: ChatGPTDirectoryRail;
let stepper: ChatGPTMessageStepperController;
let progress: TaskProgressPanel;
let progressScope: AppearanceScope;
let inputEnhancement: InputEnhancementPopover;

function mountToolbar(): void {
    const localeCopy = copy[variant.locale];
    toolbar?.dispose();
    toolbar?.getElement().remove();
    toolbar = new MessageToolbar(variant.theme, [
        {
            id: 'copy-markdown',
            label: localeCopy.copy,
            tooltip: localeCopy.copy,
            icon: Icons.copy,
            onClick: async () => ({ ok: true as const, message: localeCopy.copy }),
            hoverAction: {
                id: 'copy-png',
                label: localeCopy.copyPng,
                tooltip: localeCopy.copyPng,
                icon: Icons.image,
                onClick: async () => ({ ok: true as const, message: localeCopy.copyPng }),
            },
        },
        {
            id: 'bookmark_toggle',
            label: localeCopy.bookmark,
            tooltip: localeCopy.bookmark,
            icon: Icons.bookmark,
            onClick: async () => ({ ok: true as const, message: localeCopy.bookmark }),
        },
    ], { showStats: true, collapsible: true });
    toolbar.setPlacement('actionbar');
    toolbar.setStats(variant.locale === 'zh_CN' ? ['128 字符'] : ['128 Chars']);
    toolbar.setMessageMetadata({ updatedAt: new Date('2026-09-12T08:30:00Z').getTime() });
    toolbar.setActionActive('bookmark_toggle', true);
    turnElements[0]!.querySelector<HTMLElement>('.official-actions')!.appendChild(toolbar.getElement());
}

function mountProgress(): void {
    const host = document.querySelector<HTMLElement>('[data-role="progress-demo"]')!;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    progressScope?.dispose();
    progressScope = AppearanceScope.forShadowRoot(shadow, { styleId: 'aimd-host-controls-progress-tokens' });
    progressScope.apply(createAppearanceSnapshot(variant.theme));
    ensureStyle(shadow, TaskProgressPanel.getCss(), { id: 'aimd-host-controls-progress', cache: 'shared' });
    progress?.dispose();
    shadow.querySelector('[data-role="task-progress"]')?.remove();
    progress = new TaskProgressPanel({ cancelLabel: copy[variant.locale].bookmark, onCancel: () => undefined });
    shadow.appendChild(progress.getElement());
    progress.open({ label: copy[variant.locale].progress, completed: 3, total: 5 });
}

function mountDirectory(): void {
    directory?.dispose();
    directory = new ChatGPTDirectoryRail(variant.theme, () => undefined);
    directory.setRounds(turnElements.concat(turnElements).map((turn, index) => ({
        id: `round-${index + 1}`,
        position: index + 1,
        userPrompt: turn.querySelector('.user-message')?.textContent?.trim() || `Message ${index + 1}`,
        assistantContent: turn.querySelector('.assistant-content')?.textContent?.trim() || '',
        preview: turn.querySelector('.assistant-content')?.textContent?.trim() || '',
        messageId: `assistant-${index + 1}`,
        userMessageId: `user-${index + 1}`,
        assistantMessageId: `assistant-${index + 1}`,
    })));
    directory.setBookmarkedPositions([2, 5]);
    directory.setActivePosition(3, { follow: false });
    directory.setDisplayMode('preview');
    document.body.appendChild(directory.getElement());
}

function mountStepper(): void {
    stepper?.dispose();
    const documentRef = { key: 'fixture', platformId: 'chatgpt', conversationId: 'fixture', canonicalUrl: location.href };
    const frame: ConversationSurfaceFrameV1 = {
        frameToken: 'fixture', surfaceToken: 'fixture', contentKind: 'ready',
        document: documentRef, snapshot: null, projectionId: 'fixture', contentToken: 'fixture', pendingSurfaces: [],
        obtainedTurns: groups.map((group, index) => {
            const target = { documentKey: 'fixture', turnId: group.id, assistantMessageId: `assistant-${index + 1}`, userMessageId: `user-${index + 1}` };
            return {
                status: 'obtained', target,
                turn: { key: group.id, ordinal: index + 1, identity: target, userText: group.userPromptText ?? '', assistantMarkdown: group.assistantContentRootEl?.textContent ?? '' },
                materialization: {
                    anchorElement: turnElements[index]!, messageElement: group.assistantMessageEl!,
                    jumpAnchorElement: turnElements[index]!, userElement: group.userRootEl!, assistantElement: group.assistantRootEl!,
                    groupElements: group.groupEls,
                },
            };
        }),
    };
    const surface: ConversationSurfacePortV1 = {
        readFrame: () => frame, subscribeFrame: (listener) => { listener(frame); return () => undefined; }, refreshSurface: () => undefined,
        materialization: {
            read: () => ({ materializationToken: 'fixture', contentToken: 'fixture', entries: [] }),
            subscribe: () => () => undefined, resolveElement: () => null, locate: async () => 'missing',
        },
    };
    inputEnhancement?.dispose();
    inputEnhancement = new InputEnhancementPopover(async () => true);
    inputEnhancement.setAppearance(createAppearanceSnapshot(variant.theme));
    stepper = new ChatGPTMessageStepperController(adapter, {
        onOpenInputEnhancement: anchor => inputEnhancement.toggle(anchor),
        surface,
        onOpenBookmarksPanel: () => showToast({ text: 'Bookmarks opened' }),
        onOpenPrompts: () => showToast({ text: 'Prompts opened' }),
        onTogglePageBookmark: () => ({ ok: true, saved: true }),
        onRefreshPageBookmarkState: () => ({ ok: true, saved: true }),
    });
    stepper.init();
    stepper.setPinnedActions(['open-input-enhancement']);
    stepper.setPageBookmarked(true);
    stepper.setAppearance(createAppearanceSnapshot(variant.theme));
}

async function applyVariant(next: VisualHarnessVariant): Promise<void> {
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.body.dataset.theme = next.theme;
    document.documentElement.lang = next.locale === 'zh_CN' ? 'zh-CN' : 'en';
    await setLocale(next.locale);

    const localeCopy = copy[next.locale];
    document.querySelector<HTMLElement>('[data-role="fixture-title"]')!.textContent = localeCopy.title;
    document.querySelector<HTMLElement>('[data-role="fixture-description"]')!.textContent = localeCopy.description;
    mountToolbar();
    mountProgress();
    mountDirectory();
    mountStepper();
}

async function prepareForAudit(): Promise<void> {
    const hoverButton = toolbar.getElement().shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-markdown"]');
    hoverButton?.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
    const hoverPortal = document.querySelector<HTMLElement>('[data-aimd-role="toolbar-hover-actions"]');
    const hoverActions = hoverPortal?.shadowRoot?.querySelector<HTMLElement>('[data-role="toolbar-hover-actions"]');
    const hoverBridge = hoverPortal?.shadowRoot?.querySelector<HTMLElement>('[data-role="toolbar-hover-bridge"]');
    const secondaryAction = hoverPortal?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="copy-png"]');
    hoverButton?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
    hoverBridge?.dispatchEvent(new PointerEvent('pointerenter'));
    hoverActions?.dispatchEvent(new PointerEvent('pointerenter'));
    secondaryAction?.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));

    const directoryItem = directory.getElement().shadowRoot?.querySelector<HTMLElement>('[data-position="3"]');
    directoryItem?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    showToast({ text: copy[variant.locale].toast, tone: 'success', durationMs: 60_000 });
    const toast = document.querySelector<HTMLElement>('.aimd-toast');
    if (toast) {
        // The harness disables finite animations before capture; pin the real Toast in its visible state.
        toast.style.animation = 'none';
        toast.style.opacity = '1';
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

await applyVariant(variant);

const themeToggle = document.createElement('button');
themeToggle.textContent = 'Toggle light / dark';
themeToggle.addEventListener('click', () => void applyVariant({ ...variant, theme: variant.theme === 'light' ? 'dark' : 'light' }));
document.querySelector('.page')?.prepend(themeToggle);

installVisualHarnessBridge({
    applyVariant,
    prepareForAudit,
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [
            { role: 'toolbar-hover-actions', count: 1 },
            { role: 'chatgpt-message-stepper', count: 1 },
            { role: 'tooltip', count: 1 },
            { role: 'toast-viewport', count: 1 },
        ],
        localeEvidence: [
            document.querySelector('[data-role="fixture-title"]')?.textContent ?? '',
            toolbar.getElement().shadowRoot?.textContent ?? '',
            document.getElementById('aimd-chatgpt-message-stepper')?.textContent ?? '',
            document.getElementById('aimd-toast-viewport')?.textContent ?? '',
        ].join(' '),
    }),
});

window.addEventListener('pagehide', () => {
    toolbar.dispose();
    directory.dispose();
    stepper.dispose();
    progress.dispose();
    progressScope.dispose();
}, { once: true });
