import { getAdapter } from '../../drivers/content/adapters/registry';
import { ThemeManager } from '../../drivers/content/theme/theme-manager';
import { FormulaAssetHoverController } from '../../ui/content/controllers/FormulaAssetHoverController';
import { consumePendingNavigation, scrollToBookmarkTargetWithRetry } from '../../drivers/content/bookmarks/navigation';
import { browser } from '../../drivers/shared/browser';
import {
    requestRuntimeClient,
    RuntimeClientRequestError,
} from '../../drivers/shared/clients/clientResult';
import { PROTOCOL_VERSION, createRequestId, isExtRequest, type ExtRequest, type ExtResponse } from '../../contracts/protocol';
import { logger } from '../../core/logger';
import { ensurePageTokens } from '../../style/pageTokens';
import { MessageToolbarOrchestrator } from '../../ui/content/controllers/MessageToolbarOrchestrator';
import { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import { SettingsClient } from '../../drivers/content/settings/settingsClient';
import { DEFAULT_SETTINGS } from '../../core/settings/types';
import { resolveChatGPTInputEnhancement } from '../../core/settings/inputEnhancement';
import { setLocale, t } from '../../ui/content/components/i18n';
import { SendController } from '../../ui/content/sending/SendController';
import { ChatGPTConversationContentRuntime } from './ChatGPTConversationContentRuntime';
import { ChatGPTDirectoryController } from '../../ui/content/controllers/ChatGPTDirectoryController';
import { ChatGPTSendPositionRestoreController } from '../../ui/content/controllers/ChatGPTSendPositionRestoreController';
import { ChatGPTComposerEditingController } from '../../ui/content/controllers/ChatGPTComposerEditingController';
import { ChatGPTMessageStepperController } from '../../ui/content/controllers/ChatGPTMessageStepperController';
import { ChatGPTPromptAutocompleteController } from '../../ui/content/controllers/ChatGPTPromptAutocompleteController';
import { ChatGPTOfficialNavigationVisibilityController } from '../../ui/content/controllers/ChatGPTOfficialNavigationVisibilityController';
import { ChatGPTPageWidthController } from '../../ui/content/controllers/ChatGPTPageWidthController';
import { ChatGPTAtomicSelectionController } from '../../ui/content/controllers/ChatGPTAtomicSelectionController';
import { ChatGPTConversationReaderBinding } from '../../ui/content/controllers/ChatGPTConversationReaderBinding';
import { createPromptLibraryClient } from '../../drivers/content/prompts/promptLibraryClient';
import { OverlaySession } from '../../ui/content/overlay/OverlaySession';
import { ViewportResizeSuspendController } from '../../ui/content/controllers/ViewportResizeSuspendController';
import { navigateChatGPTDirectoryTarget } from '../../ui/content/chatgptDirectory/navigation';
import { ConversationNavigationCoordinator } from '../../services/content/ConversationNavigationCoordinator';
import { ConversationPendingNavigationRestorer } from '../../services/content/ConversationPendingNavigationRestorer';
import {
    collectFreshReaderContent,
    isReaderContentSourceRevisionCurrent,
} from '../../services/reader/readerContentSource';
import { setCanonicalMarkdownCopyFormulaFormat } from '../../services/copy/canonicalMarkdownCopy';
import {
    createCanonicalFormulaResolver,
} from '../../services/semantic-content/canonicalFormula';
import { buildReaderSessionSnapshot } from '../../services/reader/readerSessionSnapshot';
import { sendText } from '../../services/sending/sendService';
import { readComposer, writeComposer } from '../../drivers/content/sending/composerPort';
import { armChatGPTSendPositionRestore } from '../../drivers/content/chatgpt/sendPositionRestoreEvents';
import { DEFAULT_GLOBAL_FONT_SIZE_PX } from '../../core/settings/types';
import {
    normalizeChatGPTInputEnhancementSettings,
    normalizeGlobalFontSizePx,
    normalizeThemeAccentColor,
    loadAndNormalize,
} from '../../core/settings/migrations';
import type { UserThemeOverrides } from '../../style/tokens';
import { areAppearanceSnapshotsEqual, createAppearanceSnapshot, type AppearanceSnapshot } from '../../style/appearance';
import { getFormulaOnlyPlatformProfile, startFormulaOnlyRuntime } from './formulaOnlyRuntime';
import { resolveFormulaSettings, shouldEnableFormulaInteractions } from './formulaRuntimeSettings';
import {
    createLazyBookmarkSaveDialog,
    createLazyBookmarksPanel,
    createLazyCopyMessagePng,
    createLazyRenderFormulaSvgAsset,
    createLazyReaderPanel,
    createLazyRunFormulaAssetAction,
    createLazySaveMessagesDialog,
    scheduleLazyContentFeaturePrewarm,
    setLazyContentFeatureLocale,
} from './lazyContentFeatures';

const isDebugEnabled = () => {
    try {
        return window.localStorage.getItem('aimd:debug') === '1';
    } catch {
        return false;
    }
};

const writeDebugState = (patch: Record<string, string | boolean | number | null | undefined>) => {
    if (!isDebugEnabled()) return;
    for (const [key, value] of Object.entries(patch)) {
        document.documentElement.dataset[`aimdDebug${key}`] = value == null ? '' : String(value);
    }
};

const formulaOnlyProfile = getFormulaOnlyPlatformProfile();
if (formulaOnlyProfile) {
    ensurePageTokens();
    writeDebugState({
        Content: 'formula-only',
        Platform: formulaOnlyProfile.id,
        RuntimeEnabled: true,
    });
    startFormulaOnlyRuntime(formulaOnlyProfile);
    void browser.runtime.sendMessage({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'content:ready',
        payload: { platform: formulaOnlyProfile.id, url: window.location.href },
    }).catch(() => {
        // Background may be unavailable during extension reload or tab teardown; the next page lifecycle will retry.
    });
} else {
    ensurePageTokens();
}

const adapter = formulaOnlyProfile ? null : getAdapter();
if (adapter) {
    const contentAdapter = adapter;
    const themeManager = new ThemeManager();
    const mathClick = new FormulaAssetHoverController({
        parserAdapter: contentAdapter.getMarkdownParserAdapter() ?? undefined,
        runFormulaAssetAction: createLazyRunFormulaAssetAction(),
    });
    const readerPanel = createLazyReaderPanel();
    const saveMessagesDialog = createLazySaveMessagesDialog();
    const bookmarkSaveDialog = createLazyBookmarkSaveDialog();
    const copyMessagePng = createLazyCopyMessagePng();
    const sendController = new SendController();
    const settingsClient = new SettingsClient();
    const chatGptConversationContentRuntime = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTConversationContentRuntime(adapter)
        : null;
    const conversationContentSource = adapter.getPlatformId() === 'chatgpt'
        ? chatGptConversationContentRuntime?.source ?? null
        : null;
    let cancelContentFeaturePrewarm: (() => void) | null = null;
    let unsubscribeContentFeaturePrewarm: (() => void) | null = null;
    const startContentFeaturePrewarm = () => {
        if (!conversationContentSource || unsubscribeContentFeaturePrewarm) return;
        unsubscribeContentFeaturePrewarm = conversationContentSource.subscribe((state) => {
            if (!state.snapshot || cancelContentFeaturePrewarm) return;
            cancelContentFeaturePrewarm = scheduleLazyContentFeaturePrewarm();
        });
    };
    const stopContentFeaturePrewarm = () => {
        unsubscribeContentFeaturePrewarm?.();
        unsubscribeContentFeaturePrewarm = null;
        cancelContentFeaturePrewarm?.();
        cancelContentFeaturePrewarm = null;
    };
    // ChatGPT has one production content seam. The Repository owns obtained
    // messages; the Runtime-owned Surface projects those messages onto the
    // currently mounted host DOM without creating another content source.
    const conversationMaterialization = adapter.getPlatformId() === 'chatgpt'
        ? chatGptConversationContentRuntime?.materialization ?? null
        : null;
    const conversationNavigation = adapter.getPlatformId() === 'chatgpt' && conversationContentSource
        ? new ConversationNavigationCoordinator({
            source: conversationContentSource,
            execute: (target, options) => navigateChatGPTDirectoryTarget(adapter, target, {
                timeoutMs: options.timeoutMs,
                signal: options.signal,
                alignmentTimeoutMs: Math.min(options.timeoutMs ?? 15000, 1500),
                surface: chatGptConversationContentRuntime!.surface,
            }),
        })
        : null;
    const pendingNavigationRestorer = conversationNavigation
        ? new ConversationPendingNavigationRestorer({
            navigation: conversationNavigation,
            source: conversationContentSource!,
        })
        : null;
    if (chatGptConversationContentRuntime && typeof chatGptConversationContentRuntime.setNavigationPort === 'function') {
        chatGptConversationContentRuntime.setNavigationPort(conversationNavigation);
    }
    const bookmarksController = new BookmarksPanelController(adapter, {
        navigation: conversationNavigation,
        conversationContentSource,
        readDiscoveryDiagnostics: () => chatGptConversationContentRuntime?.readDiscoveryDiagnostics() ?? null,
        retryBaselineDiscovery: () => chatGptConversationContentRuntime?.retryBaselineDiscovery()
            ?? Promise.resolve(null),
    });
    if (chatGptConversationContentRuntime && !('__AIMD_DISCOVERY_DIAGNOSTICS__' in window)) {
        // Advanced-troubleshooting seam. The snapshot contains only counts and
        // status facts; it never exposes message bodies or personal content.
        Object.defineProperty(window, '__AIMD_DISCOVERY_DIAGNOSTICS__', {
            value: () => chatGptConversationContentRuntime!.readDiscoveryDiagnostics(),
            configurable: true,
        });
    }
    if (conversationContentSource && conversationMaterialization) {
        const parser = contentAdapter.getMarkdownParserAdapter();
        if (parser) {
            mathClick.setCanonicalFormulaResolver?.(createCanonicalFormulaResolver(
                conversationContentSource,
                conversationMaterialization,
                parser,
            ));
        }
    }
    // The directory is a host surface, not a consequence of baseline
    // admission. Create and mount it even while the semantic source is
    // still unavailable so a transient discovery failure cannot remove the
    // visible navigation affordance.
    const chatGptDirectory = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTDirectoryController(adapter, bookmarksController, {
            surface: chatGptConversationContentRuntime!.surface,
            navigation: conversationNavigation,
        })
        : null;
    const chatGptOfficialNavigationVisibility = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTOfficialNavigationVisibilityController()
        : null;
    const viewportResizeSuspend = adapter.getPlatformId() === 'chatgpt'
        ? new ViewportResizeSuspendController()
        : null;
    const chatGptSendPositionRestore = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTSendPositionRestoreController(adapter)
        : null;
    const chatGptComposerEditing = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTComposerEditingController(adapter, {
            renderFormula: createLazyRenderFormulaSvgAsset(),
            onInputEnhancementChange: async (inputEnhancement) => {
                const current = {
                    ...DEFAULT_SETTINGS.chatgptBehavior,
                    ...settingsClient.getCached()?.chatgptBehavior,
                };
                return settingsClient.setCategory('chatgptBehavior', {
                    ...current,
                    inputEnhancement,
                });
            },
        })
        : null;
    const promptLibraryClient = adapter.getPlatformId() === 'chatgpt'
        ? createPromptLibraryClient()
        : null;
    const chatGptPromptAutocomplete = promptLibraryClient
        ? new ChatGPTPromptAutocompleteController(adapter, promptLibraryClient)
        : null;
    sendController.setPromptAutocompleteController(chatGptPromptAutocomplete);
    const bookmarksPanel = createLazyBookmarksPanel(bookmarksController, readerPanel, {
        onOpenPromptManager: (anchor) => chatGptPromptAutocomplete?.openManager(anchor),
    });
    const chatGptMessageStepper = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTMessageStepperController(adapter, {
            surface: chatGptConversationContentRuntime!.surface,
            navigation: conversationNavigation,
            onOpenBookmarksPanel: () => bookmarksPanel.toggle(),
            onOpenDetachedReader: () => openDetachedReaderFromStepper(),
            onOpenPrompts: (anchor) => chatGptPromptAutocomplete?.openManager(anchor),
            onTogglePageBookmark: async (url) => {
                const status = await bookmarksController.readPageBookmarkStatus(url);
                if (!status.ok) {
                    bookmarksController.setPanelStatus(status.message);
                    return { ok: false as const, message: status.message };
                }
                const alreadySaved = status.data.saved;
                let title = resolveCurrentPageBookmarkTitle(url);
                let folderPath = bookmarksController.getDefaultFolderPath();

                if (!alreadySaved) {
                    const dialogRes = await bookmarkSaveDialog.open({
                        theme: getCurrentAppearance().theme,
                        userPrompt: title,
                        existingTitle: title,
                        currentFolderPath: folderPath,
                        mode: 'create',
                    });
                    if (!dialogRes.ok) {
                        return { ok: false as const, cancelled: true as const };
                    }
                    title = dialogRes.title;
                    folderPath = dialogRes.folderPath;
                }

                if ((window.location.href.split('#')[0] || window.location.href) !== url) {
                    return { ok: false as const, message: t('contentNotFound') };
                }

                const res = await bookmarksController.setPageBookmarkSaved({
                    url,
                    title,
                    platform: 'ChatGPT',
                    folderPath,
                }, !alreadySaved);
                if (!res.ok) {
                    bookmarksController.setPanelStatus(res.message);
                    return { ok: false as const, message: res.message };
                }
                return { ok: true as const, saved: res.data.saved };
            },
            onRefreshPageBookmarkState: async (url) => {
                const status = await bookmarksController.readPageBookmarkStatus(url);
                return status.ok
                    ? { ok: true as const, saved: status.data.saved }
                    : { ok: false as const, message: status.message };
            },
        })
        : null;
    const chatGptPageWidth = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTPageWidthController()
        : null;
    const chatGptAtomicSelection = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTAtomicSelectionController(adapter, {
            contentSource: conversationContentSource,
            materialization: conversationMaterialization,
        })
        : null;
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        sendController,
        bookmarksController,
        saveMessagesDialog,
        bookmarkSaveDialog,
        copyMessagePng,
        conversationContentSource,
        conversationMaterialization,
        conversationSurface: chatGptConversationContentRuntime?.surface ?? null,
        conversationNavigation,
    });
    const chatGptConversationReaderBinding = conversationContentSource
        ? new ChatGPTConversationReaderBinding({
            adapter,
            source: conversationContentSource,
            materialization: conversationMaterialization,
            readerPanel,
            pageUrl: () => window.location.href.split('#')[0] || window.location.href,
            prepareItems: (items) => {
                const url = window.location.href.split('#')[0] || window.location.href;
                const bookmarkable = Boolean(conversationContentSource.read().document?.conversationId);
                const turns = items
                    .map((item) => ({
                        position: Number(item.meta?.position ?? 0),
                        assistantMessageId: String(item.meta?.assistantMessageId ?? item.meta?.messageId ?? '').trim(),
                    }))
                    .filter((turn) => turn.position > 0 && turn.assistantMessageId.length > 0);
                const bookmarkedPositions = bookmarkable
                    ? bookmarksController.resolveConversationBookmarkPositions(url, turns)
                    : new Set<number>();
                for (const item of items) {
                    const position = Number(item.meta?.position ?? 0);
                    item.meta = {
                        ...(item.meta ?? {}),
                        url,
                        bookmarkable: bookmarkable && position > 0,
                        bookmarked: bookmarkable && position > 0
                            ? bookmarkedPositions.has(position)
                            : false,
                    };
                }
            },
        })
        : null;

    settingsClient.init();
    const cachedSettings = settingsClient.getCached();
    themeManager.init(adapter);
    let lastLocale = cachedSettings?.language ?? DEFAULT_SETTINGS.language;
    const platformKey = 'chatgpt' as const;
    let runtimeEnabled = adapter.getPlatformId() === 'chatgpt'
        ? cachedSettings?.platforms?.[platformKey] ?? true
        : false;
    let atomicSelectionEnabled = false;
    const setAtomicSelectionEnabled = (enabled: boolean) => {
        if (enabled === atomicSelectionEnabled) return;
        atomicSelectionEnabled = enabled;
        if (enabled) {
            chatGptAtomicSelection?.init();
        } else {
            chatGptAtomicSelection?.dispose();
        }
    };
    const initialAppearance = createAppearanceSnapshot(
        document.documentElement.getAttribute('data-aimd-theme') === 'dark' ? 'dark' : 'light',
        getThemeOverrides(cachedSettings),
    );
    let currentAppearance: AppearanceSnapshot | null = null;
    const getCurrentAppearance = (): AppearanceSnapshot => currentAppearance ?? initialAppearance;
    let formulaInteractionsEnabled: boolean | null = null;
    writeDebugState({
        Content: 'loaded',
        Platform: adapter.getPlatformId(),
        RuntimeEnabled: runtimeEnabled,
        DirectoryAvailable: Boolean(chatGptDirectory),
    });
    const syncClickToCopy = (enabled: boolean) => {
        if (formulaInteractionsEnabled === enabled) return;
        formulaInteractionsEnabled = enabled;
        if (!enabled) {
            mathClick.disable();
            return;
        }
        mathClick.observeContainers(document.body || document.documentElement, adapter.getMessageSelector());
    };

    const syncFormulaSettings = (
        settings: typeof DEFAULT_SETTINGS.formula | undefined,
        options: { applyInteractionGate?: boolean } = {},
    ) => {
        const next = resolveFormulaSettings(settings);
        mathClick.setFormulaSettings(next);
        setCanonicalMarkdownCopyFormulaFormat(next.markdownCopyFormulaFormat);
        saveMessagesDialog.setMarkdownFormulaFormat(next.markdownCopyFormulaFormat);
        if (options.applyInteractionGate === false) return;
        if (!runtimeEnabled) {
            syncClickToCopy(false);
            return;
        }
        syncClickToCopy(shouldEnableFormulaInteractions(next));
    };

    async function confirmDetachedReaderExperimentIfNeeded(): Promise<boolean> {
        const settings = settingsClient.getCached() ?? DEFAULT_SETTINGS;
        if (settings.reader.detachedNoticeConfirmed) return true;

        const noticeSession = new OverlaySession({
            id: 'aimd-detached-reader-notice-host',
            theme: getCurrentAppearance().theme,
            themeOverrides: getCurrentAppearance().overrides,
            surfaceCss: '',
            lockScroll: true,
            surfaceStyleId: 'aimd-detached-reader-notice-surface',
            overlayStyleId: 'aimd-detached-reader-notice-overlay',
        });
        try {
            const ok = await noticeSession.modalHost.confirm({
                kind: 'warning',
                title: t('detachedReaderExperimentalTitle'),
                message: t('detachedReaderExperimentalMessage'),
                confirmText: t('detachedReaderExperimentalConfirm'),
                cancelText: t('detachedReaderExperimentalCancel'),
            });
            return ok;
        } finally {
            noticeSession.unmount();
        }
    }

    async function markDetachedReaderNoticeConfirmed(): Promise<void> {
        const current = settingsClient.getCached()?.reader ?? DEFAULT_SETTINGS.reader;
        if (current.detachedNoticeConfirmed) return;
        await settingsClient.setCategory('reader', {
            ...current,
            detachedNoticeConfirmed: true,
        });
    }

    async function openDetachedReaderFromStepper(): Promise<void> {
        if (!runtimeEnabled || contentAdapter.getPlatformId() !== 'chatgpt') return;
        const confirmed = await confirmDetachedReaderExperimentIfNeeded();
        if (!confirmed) return;

        const itemsResult = await collectFreshReaderContent(contentAdapter, null, {
            conversationContentSource,
            conversationMaterialization,
            pageUrl: window.location.href,
        });
        const snapshot = await buildReaderSessionSnapshot({
            items: itemsResult.items,
            startIndex: itemsResult.startIndex,
            sourceUrl: window.location.href,
            theme: getCurrentAppearance().theme,
            annotationDocument: itemsResult.annotationDocument,
        });
        if (!isReaderContentSourceRevisionCurrent(
            conversationContentSource,
            itemsResult.sourceRevision,
        )) {
            return;
        }
        const response = await requestRuntimeClient({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:create',
            payload: { snapshot },
        }, { timeoutMs: 12000 });
        if (!response.ok) {
            // Keep this non-blocking; the detached page is an auxiliary speed surface.
            logger.warn('Detached reader open failed', {
                errorCode: response.errorCode,
                error: response.message,
            });
            return;
        }
        await markDetachedReaderNoticeConfirmed();
    }

    async function listReaderPromptsFromLibrary() {
        if (!promptLibraryClient) return [];
        const prompts = await promptLibraryClient.listPrompts({ context: 'readerComment' });
        return prompts.map((prompt) => ({
            id: prompt.id,
            title: prompt.title,
            content: prompt.content,
        }));
    }

    const initChatGptIfNeeded = () => {
        if (adapter.getPlatformId() !== 'chatgpt') return;
        if (conversationContentSource) {
            chatGptConversationReaderBinding?.init();
            viewportResizeSuspend?.init();
            chatGptSendPositionRestore?.init();
            chatGptComposerEditing?.init();
            chatGptPromptAutocomplete?.init();
            chatGptMessageStepper?.init();
            chatGptPageWidth?.init();
            syncChatGptBehaviorSettings(settingsClient.getCached()?.chatgptBehavior);
            chatGptConversationContentRuntime?.init();
            startContentFeaturePrewarm();
        }
        if (!chatGptDirectory) return;
        writeDebugState({ ChatGptInit: 'start' });
        chatGptDirectory.init(getCurrentAppearance().theme);
        syncChatGptDirectorySettings(settingsClient.getCached()?.chatgptDirectory);
        writeDebugState({ ChatGptInit: 'done' });
    };

    const syncChatGptDirectorySettings = (settings: typeof DEFAULT_SETTINGS.chatgptDirectory | undefined) => {
        if (!chatGptDirectory) return;
        const next = {
            ...DEFAULT_SETTINGS.chatgptDirectory,
            ...settings,
        };
        chatGptDirectory.setDisplayMode(next.mode === 'expanded' ? 'expanded' : 'preview');
        chatGptDirectory.setPromptLabelMode(next.promptLabelMode === 'headTail' ? 'headTail' : 'head');
        chatGptDirectory.setRightInsetPx(next.rightInsetPx);
        chatGptDirectory.setEnabled(Boolean(next.enabled));
        chatGptOfficialNavigationVisibility?.setEnabled(Boolean(next.enabled && next.hideOfficialNavigation));
    };

    const syncChatGptBehaviorSettings = (settings: typeof DEFAULT_SETTINGS.chatgptBehavior | undefined) => {
        const next = {
            ...DEFAULT_SETTINGS.chatgptBehavior,
            ...settings,
        };
        const inputEnhancement = normalizeChatGPTInputEnhancementSettings(
            (settings as any)?.inputEnhancement,
            settings,
        );
        const effectiveInputEnhancement = resolveChatGPTInputEnhancement(inputEnhancement);
        chatGptAtomicSelection?.setMarkdownCopyShortcut(next.atomicMarkdownCopyShortcut);
        setAtomicSelectionEnabled(Boolean(runtimeEnabled));
        chatGptSendPositionRestore?.setEnabled(Boolean(next.restorePositionAfterSend));
        chatGptSendPositionRestore?.setEnterKeyNewlineEnabled(effectiveInputEnhancement.enterKeyNewline);
        chatGptComposerEditing?.setInputEnhancementSettings(inputEnhancement);
        chatGptPromptAutocomplete?.setFormulaAuthoringEnabled?.(
            effectiveInputEnhancement.formulaSuggestions || effectiveInputEnhancement.formulaPreview,
        );
        chatGptMessageStepper?.setVisible(Boolean(next.showMessageStepper));
        chatGptMessageStepper?.setPageBookmarkControlVisible(Boolean(next.showPageBookmarkControl));
        chatGptMessageStepper?.setDetachedReaderControlVisible(Boolean(next.showDetachedReaderControl));
        chatGptMessageStepper?.setPromptControlVisible(Boolean(next.showPromptControl));
        chatGptPromptAutocomplete?.setEnabled(Boolean(next.promptAutocomplete));
        chatGptMessageStepper?.setKeyboardEnabled(Boolean(next.enableArrowKeyMessageNavigation));
        chatGptPageWidth?.setScale(next.pageWidthScale);
    };

    const applyAppearance = (nextSnapshot: AppearanceSnapshot) => {
        if (currentAppearance && areAppearanceSnapshotsEqual(currentAppearance, nextSnapshot)) {
            return;
        }
        currentAppearance = nextSnapshot;
        ensurePageTokens(nextSnapshot.overrides);
        mathClick.setAppearance(nextSnapshot);
        messageToolbars.setAppearance(nextSnapshot);
        readerPanel.setAppearance(nextSnapshot);
        sendController.setAppearance(nextSnapshot);
        bookmarksController.setAppearance(nextSnapshot);
        saveMessagesDialog.setAppearance(nextSnapshot);
        bookmarkSaveDialog.setAppearance(nextSnapshot);
        chatGptDirectory?.setAppearance(nextSnapshot);
        chatGptPromptAutocomplete?.setAppearance(nextSnapshot);
        chatGptComposerEditing?.setAppearance(nextSnapshot);
        chatGptMessageStepper?.setAppearance(nextSnapshot);
    };

    const syncAppearanceOverrides = (settings: typeof DEFAULT_SETTINGS | null | undefined) => {
        applyAppearance(createAppearanceSnapshot(getCurrentAppearance().theme, getThemeOverrides(settings)));
    };

    const enableRuntime = () => {
        if (runtimeEnabled) return;
        runtimeEnabled = true;
        writeDebugState({ RuntimeEnabled: runtimeEnabled });
        initChatGptIfNeeded();
        messageToolbars.init();
    };

    const disableRuntime = () => {
        if (!runtimeEnabled) return;
        runtimeEnabled = false;
        writeDebugState({ RuntimeEnabled: runtimeEnabled });
        messageToolbars.dispose();
        conversationNavigation?.cancelActive();
        pendingNavigationRestorer?.dispose();
        stopContentFeaturePrewarm();
        chatGptConversationReaderBinding?.dispose();
        chatGptDirectory?.dispose();
        chatGptOfficialNavigationVisibility?.dispose();
        chatGptConversationContentRuntime?.dispose();
        viewportResizeSuspend?.dispose();
        chatGptSendPositionRestore?.dispose();
        chatGptComposerEditing?.dispose();
        chatGptPromptAutocomplete?.dispose();
        chatGptMessageStepper?.dispose();
        chatGptPageWidth?.dispose();
        setAtomicSelectionEnabled(false);
        contentAdapter.dispose?.();
    };

    // Apply initial UI locale immediately (otherwise switching to a non-auto locale won't take effect until a change event).
    void setLocale(lastLocale);
    setLazyContentFeatureLocale(lastLocale);
    applyAppearance(initialAppearance);
    if (cachedSettings?.reader) {
        readerPanel.setReaderSettings(cachedSettings.reader);
    }
    const initialReaderSettings = cachedSettings?.reader ?? DEFAULT_SETTINGS.reader;
    let confirmedReaderSettings = cachedSettings?.reader ?? null;
    let readerSettingsWriteQueue: Promise<void> = Promise.resolve();
    readerPanel.setReaderSettingsController({
        onChange: (patch) => {
            const write = readerSettingsWriteQueue.then(async () => {
                if (!confirmedReaderSettings) {
                    const canonical = await settingsClient.getCategoryResult('reader');
                    if (!canonical.ok) {
                        readerPanel.setReaderSettings(initialReaderSettings);
                        throw new RuntimeClientRequestError(canonical.failure);
                    }
                    if (typeof canonical.data !== 'object' || canonical.data === null || Array.isArray(canonical.data)) {
                        readerPanel.setReaderSettings(initialReaderSettings);
                        throw new RuntimeClientRequestError({
                            kind: 'transport',
                            code: 'INVALID_RESPONSE',
                            message: 'Invalid Reader settings response',
                            delivery: 'unknown',
                        });
                    }
                    confirmedReaderSettings = loadAndNormalize({ version: 4, reader: canonical.data }).reader;
                }
                const next = { ...confirmedReaderSettings, ...patch };
                const result = await settingsClient.setCategoryResult('reader', next);
                if (!result.ok) {
                    readerPanel.setReaderSettings(confirmedReaderSettings);
                    throw new RuntimeClientRequestError(result.failure);
                }
                confirmedReaderSettings = next;
                readerPanel.setReaderSettings(confirmedReaderSettings);
            });
            readerSettingsWriteQueue = write.catch(() => undefined);
            return write;
        },
    });
    readerPanel.setPromptManagerController({
        onOpenManager: (anchor) => chatGptPromptAutocomplete?.openManager(anchor),
        listReaderPrompts: listReaderPromptsFromLibrary,
    });
    syncFormulaSettings(cachedSettings?.formula, { applyInteractionGate: false });
    saveMessagesDialog.setExportSettings(cachedSettings?.export ?? DEFAULT_SETTINGS.export);
    messageToolbars.setExportSettings(cachedSettings?.export ?? DEFAULT_SETTINGS.export);
    messageToolbars.setBehaviorFlags({
        showMessageToolbar: cachedSettings?.behavior?.showMessageToolbar ?? DEFAULT_SETTINGS.behavior.showMessageToolbar,
        showSaveMessages: cachedSettings?.behavior?.showSaveMessages ?? DEFAULT_SETTINGS.behavior.showSaveMessages,
        showWordCount: cachedSettings?.behavior?.showWordCount ?? DEFAULT_SETTINGS.behavior.showWordCount,
    });
    settingsClient.subscribe((snap) => {
        if (snap.settings.language !== lastLocale) {
            lastLocale = snap.settings.language;
            void setLocale(lastLocale);
            setLazyContentFeatureLocale(lastLocale);
        }
        const nextRuntimeEnabled = adapter.getPlatformId() === 'chatgpt'
            ? snap.settings.platforms?.[platformKey] ?? true
            : false;
        if (nextRuntimeEnabled) enableRuntime();
        syncChatGptDirectorySettings(snap.settings.chatgptDirectory);
        syncChatGptBehaviorSettings(snap.settings.chatgptBehavior);
        if (!nextRuntimeEnabled) disableRuntime();
        syncFormulaSettings(snap.settings.formula);
        confirmedReaderSettings = snap.settings.reader;
        readerPanel.setReaderSettings(snap.settings.reader);
        saveMessagesDialog.setExportSettings(snap.settings.export ?? DEFAULT_SETTINGS.export);
        messageToolbars.setExportSettings(snap.settings.export ?? DEFAULT_SETTINGS.export);
        syncAppearanceOverrides(snap.settings);
        messageToolbars.setBehaviorFlags({
            showMessageToolbar: snap.settings.behavior?.showMessageToolbar ?? DEFAULT_SETTINGS.behavior.showMessageToolbar,
            showSaveMessages: snap.settings.behavior?.showSaveMessages ?? DEFAULT_SETTINGS.behavior.showSaveMessages,
            showWordCount: snap.settings.behavior?.showWordCount ?? DEFAULT_SETTINGS.behavior.showWordCount,
        });
    });

    themeManager.subscribe((theme) => {
        applyAppearance(createAppearanceSnapshot(theme, getCurrentAppearance().overrides));
    });

    const handleDetachedReaderRequest = async (request: ExtRequest): Promise<ExtResponse> => {
        try {
            if (request.type === 'readerSession:refresh') {
                const result = await collectFreshReaderContent(adapter, null, {
                    conversationContentSource,
                    conversationMaterialization,
                    pageUrl: window.location.href,
                });
                const snapshot = await buildReaderSessionSnapshot({
                    items: result.items,
                    startIndex: result.startIndex,
                    sourceUrl: window.location.href,
                    theme: getCurrentAppearance().theme,
                    annotationDocument: result.annotationDocument,
                });
                if (
                    adapter.getPlatformId() === 'chatgpt'
                    && !isReaderContentSourceRevisionCurrent(
                        conversationContentSource,
                        result.sourceRevision,
                    )
                ) {
                    return {
                        v: PROTOCOL_VERSION,
                        id: request.id,
                        ok: false,
                        type: request.type,
                        error: {
                            code: 'SOURCE_UNAVAILABLE',
                            message: 'Conversation changed before Reader refreshed',
                        },
                    };
                }
                return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data: { snapshot } };
            }

            if (request.type === 'readerSession:draft') {
                if (typeof request.payload.text === 'string') {
                    const result = await writeComposer(adapter, request.payload.text, { focus: false, strategy: 'auto' });
                    if (!result.ok) {
                        return {
                            v: PROTOCOL_VERSION,
                            id: request.id,
                            ok: false,
                            type: request.type,
                            error: { code: 'SOURCE_UNAVAILABLE', message: result.message },
                        };
                    }
                    return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data: { written: true } };
                }

                const result = readComposer(adapter);
                if (!result.ok) {
                    return {
                        v: PROTOCOL_VERSION,
                        id: request.id,
                        ok: false,
                        type: request.type,
                        error: { code: 'SOURCE_UNAVAILABLE', message: result.message },
                    };
                }
                return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data: { text: result.text } };
            }

            if (request.type === 'readerSession:beforeSend') {
                armChatGPTSendPositionRestore();
                return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data: { ready: true } };
            }

            if (request.type === 'readerSession:send') {
                const result = await sendText(adapter, request.payload.text, { focusComposer: true, timeoutMs: 3000 });
                if (!result.ok) {
                    return {
                        v: PROTOCOL_VERSION,
                        id: request.id,
                        ok: false,
                        type: request.type,
                        error: { code: 'SOURCE_UNAVAILABLE', message: result.message },
                    };
                }
                return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data: { sent: true } };
            }

            if (request.type === 'readerSession:locate') {
                const position = Math.max(1, Math.round(Number(request.payload.position ?? 0)));
                const result = adapter.getPlatformId() === 'chatgpt'
                    ? conversationNavigation
                        ? await conversationNavigation.navigate({
                            position,
                            messageId: request.payload.messageId ?? null,
                            assistantMessageId: request.payload.messageId ?? null,
                            source: 'reader',
                        }, { timeoutMs: 15000, align: 'start' })
                        : { ok: false as const, reason: 'source-unavailable' as const }
                    : await scrollToBookmarkTargetWithRetry(adapter, {
                        position,
                        messageId: request.payload.messageId ?? null,
                    }, { timeoutMs: 2500, intervalMs: 200 });
                if (!result.ok) {
                    return {
                        v: PROTOCOL_VERSION,
                        id: request.id,
                        ok: false,
                        type: request.type,
                        error: { code: 'NOT_FOUND', message: 'Message position not found' },
                    };
                }
                return { v: PROTOCOL_VERSION, id: request.id, ok: true, type: request.type, data: { located: true } };
            }
        } catch (error) {
            return {
                v: PROTOCOL_VERSION,
                id: request.id,
                ok: false,
                type: request.type,
                error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Detached reader request failed' },
            };
        }

        return {
            v: PROTOCOL_VERSION,
            id: request.id,
            ok: false,
            type: request.type,
            error: { code: 'UNKNOWN_TYPE', message: 'Unsupported detached reader request' },
        };
    };

    browser.runtime.onMessage.addListener((msg: unknown, _sender: unknown, sendResponse?: (response: unknown) => void) => {
        if (!isExtRequest(msg)) return;
        if (msg.type === 'ping') {
            sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: true, type: msg.type, data: { pong: true } });
            return true;
        }
        if (msg.type === 'ui:toggle_toolbar') {
            void bookmarksPanel.toggle();
        }
        if (msg.type === 'annotations:focus') {
            void (async () => {
                if (adapter.getPlatformId() !== 'chatgpt' || !conversationContentSource) {
                    sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'SOURCE_UNAVAILABLE', message: 'ChatGPT Reader is unavailable' } });
                    return;
                }
                const result = await collectFreshReaderContent(adapter, null, {
                    conversationContentSource,
                    conversationMaterialization,
                    pageUrl: window.location.href,
                });
                if (!result.annotationDocument || result.annotationDocument.conversationId !== msg.payload.document.conversationId) {
                    sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'SOURCE_UNAVAILABLE', message: 'Conversation identity could not be verified' } });
                    return;
                }
                const sourceRevisionIsCurrent = () => isReaderContentSourceRevisionCurrent(
                    conversationContentSource,
                    result.sourceRevision,
                );
                if (!sourceRevisionIsCurrent()) {
                    sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'SOURCE_UNAVAILABLE', message: 'Conversation changed before Reader opened' } });
                    return;
                }
                await readerPanel.show(result.items, result.startIndex, getCurrentAppearance().theme, {
                    profile: 'conversation-reader',
                    annotationDocument: result.annotationDocument,
                });
                if (!sourceRevisionIsCurrent()) {
                    readerPanel.hide();
                    sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'SOURCE_UNAVAILABLE', message: 'Conversation changed before annotation focus' } });
                    return;
                }
                const focused = await readerPanel.focusAnnotation(msg.payload.annotationId, undefined);
                if (!sourceRevisionIsCurrent()) {
                    readerPanel.hide();
                    sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'SOURCE_UNAVAILABLE', message: 'Conversation changed during annotation focus' } });
                    return;
                }
                sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: focused, type: msg.type, ...(focused ? { data: { focused: true } } : { error: { code: 'NOT_FOUND', message: 'Annotation was not found in this conversation' } }) });
            })().catch((error) => {
                sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: false, type: msg.type, error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not focus annotation' } });
            });
            return true;
        }
        if (msg.type === 'readerSession:refresh' || msg.type === 'readerSession:draft' || msg.type === 'readerSession:beforeSend' || msg.type === 'readerSession:send' || msg.type === 'readerSession:locate') {
            void handleDetachedReaderRequest(msg).then((response) => sendResponse?.(response));
            return true;
        }
    });

    if (runtimeEnabled) {
        messageToolbars.init();
        initChatGptIfNeeded();
    }

    // ChatGPT may keep this runtime alive across a SPA route transition. Keep
    // the target until the shared canonical navigation attempt completes.
    if (pendingNavigationRestorer) {
        pendingNavigationRestorer.start();
    } else {
        // Best-effort navigation for non-ChatGPT platforms keeps the legacy
        // one-shot behavior and storage contract.
        const pending = consumePendingNavigation();
        if (pending) {
            const pendingNavigation = adapter.getPlatformId() === 'chatgpt'
                ? Promise.resolve({ ok: false as const, reason: 'source-unavailable' as const })
                : scrollToBookmarkTargetWithRetry(adapter, pending, { timeoutMs: 8000, intervalMs: 200 });
            void pendingNavigation;
        }
    }

    if (adapter.getPlatformId() === 'chatgpt') {
        void browser.runtime.sendMessage({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'content:ready',
            payload: { platform: 'chatgpt', url: window.location.href },
        }).catch(() => {
            // Background may be unavailable during extension reload or tab teardown; the next page lifecycle will retry.
        });
    }
}

function resolveCurrentPageBookmarkTitle(url: string): string {
    const raw = (document.title || '').trim();
    const cleaned = raw
        .replace(/\s*[|·-]\s*ChatGPT\s*$/i, '')
        .replace(/^ChatGPT\s*[|·-]\s*/i, '')
        .trim();
    if (cleaned && !/^chatgpt$/i.test(cleaned)) return cleaned;
    try {
        const parsed = new URL(url);
        const last = parsed.pathname.split('/').filter(Boolean).pop();
        return last || parsed.hostname || url;
    } catch {
        return url;
    }
}

function getThemeOverrides(settings: typeof DEFAULT_SETTINGS | null | undefined): UserThemeOverrides {
    const fontSizePx = normalizeGlobalFontSizePx(settings?.appearance?.fontSizePx);
    const accentColor = normalizeThemeAccentColor(settings?.appearance?.accentColor);
    return {
        ...(accentColor ? { accentColor } : {}),
        baseFontScale: fontSizePx / DEFAULT_GLOBAL_FONT_SIZE_PX,
    };
}
