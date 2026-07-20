import { getAdapter } from '../../drivers/content/adapters/registry';
import { ThemeManager } from '../../drivers/content/theme/theme-manager';
import { FormulaAssetHoverController } from '../../ui/content/controllers/FormulaAssetHoverController';
import { consumePendingNavigation, scrollToBookmarkTargetWithRetry } from '../../drivers/content/bookmarks/navigation';
import { browser } from '../../drivers/shared/browser';
import { sendExtRequest } from '../../drivers/shared/rpc';
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
import { ChatGPTConversationEngine } from '../../drivers/content/chatgpt/ChatGPTConversationEngine';
import { getChatGPTConversationIndex } from '../../drivers/content/chatgpt/ChatGPTConversationIndex';
import { ChatGPTDirectoryController } from '../../ui/content/controllers/ChatGPTDirectoryController';
import { ChatGPTSendPositionRestoreController } from '../../ui/content/controllers/ChatGPTSendPositionRestoreController';
import { ChatGPTComposerEditingController } from '../../ui/content/controllers/ChatGPTComposerEditingController';
import { ChatGPTMessageStepperController } from '../../ui/content/controllers/ChatGPTMessageStepperController';
import { ChatGPTPromptAutocompleteController } from '../../ui/content/controllers/ChatGPTPromptAutocompleteController';
import { ChatGPTOfficialNavigationVisibilityController } from '../../ui/content/controllers/ChatGPTOfficialNavigationVisibilityController';
import { ChatGPTPageWidthController } from '../../ui/content/controllers/ChatGPTPageWidthController';
import { ChatGPTAtomicSelectionController } from '../../ui/content/controllers/ChatGPTAtomicSelectionController';
import { createPromptLibraryClient } from '../../drivers/content/prompts/promptLibraryClient';
import { OverlaySession } from '../../ui/content/overlay/OverlaySession';
import { ViewportResizeSuspendController } from '../../ui/content/controllers/ViewportResizeSuspendController';
import { navigateChatGPTDirectoryTarget } from '../../ui/content/chatgptDirectory/navigation';
import { collectFreshReaderContent } from '../../services/reader/readerContentSource';
import { ChatGPTLiveDomContent } from '../../services/content/ChatGPTLiveDomContent';
import { setReaderMarkdownCopyFormulaFormat } from '../../services/reader/readerMarkdownCopy';
import { buildReaderSessionSnapshot } from '../../services/reader/readerSessionSnapshot';
import { sendText } from '../../services/sending/sendService';
import { readComposer, writeComposer } from '../../drivers/content/sending/composerPort';
import { armChatGPTSendPositionRestore } from '../../drivers/content/chatgpt/sendPositionRestoreEvents';
import { DEFAULT_GLOBAL_FONT_SIZE_PX } from '../../core/settings/types';
import {
    normalizeChatGPTInputEnhancementSettings,
    normalizeGlobalFontSizePx,
    normalizeThemeAccentColor,
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
        runFormulaAssetAction: createLazyRunFormulaAssetAction(),
    });
    const readerPanel = createLazyReaderPanel();
    const saveMessagesDialog = createLazySaveMessagesDialog();
    const bookmarkSaveDialog = createLazyBookmarkSaveDialog();
    const copyMessagePng = createLazyCopyMessagePng();
    const sendController = new SendController();
    const settingsClient = new SettingsClient();
    const bookmarksController = new BookmarksPanelController(adapter);
    const chatGptConversationEngine = adapter.getPlatformId() === 'chatgpt' ? new ChatGPTConversationEngine(adapter) : null;
    const chatGptLiveDomContent = chatGptConversationEngine
        ? new ChatGPTLiveDomContent(adapter, chatGptConversationEngine)
        : null;
    let chatGptConversationIndexBound = false;
    const bindChatGptConversationIndex = () => {
        if (!chatGptConversationEngine || chatGptConversationIndexBound) return;
        getChatGPTConversationIndex(adapter).bindSnapshotSource(chatGptConversationEngine);
        chatGptConversationIndexBound = true;
    };
    const chatGptDirectory = adapter.getPlatformId() === 'chatgpt' && chatGptConversationEngine
        ? new ChatGPTDirectoryController(adapter, bookmarksController)
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
            onOpenBookmarksPanel: () => bookmarksPanel.toggle(),
            onOpenDetachedReader: () => openDetachedReaderFromStepper(),
            onOpenPrompts: (anchor) => chatGptPromptAutocomplete?.openManager(anchor),
            onTogglePageBookmark: async () => {
                const url = window.location.href.split('#')[0] || window.location.href;
                const alreadySaved = bookmarksController.isCurrentPageBookmarked(url);
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
                        return { saved: bookmarksController.isCurrentPageBookmarked(url) };
                    }
                    title = dialogRes.title;
                    folderPath = dialogRes.folderPath;
                }

                const res = await bookmarksController.togglePageBookmarkForCurrentPage({
                    url,
                    title,
                    platform: 'ChatGPT',
                    folderPath,
                });
                if (!res.ok) {
                    bookmarksController.setPanelStatus(res.message);
                    return { saved: bookmarksController.isCurrentPageBookmarked(url) };
                }
                return res.data;
            },
            onRefreshPageBookmarkState: async (url) => bookmarksController.refreshPageBookmarkStatus(url),
        })
        : null;
    const chatGptPageWidth = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTPageWidthController()
        : null;
    const chatGptAtomicSelection = adapter.getPlatformId() === 'chatgpt'
        ? new ChatGPTAtomicSelectionController(adapter)
        : null;
    const messageToolbars = new MessageToolbarOrchestrator(adapter, {
        readerPanel,
        sendController,
        bookmarksController,
        saveMessagesDialog,
        bookmarkSaveDialog,
        copyMessagePng,
        chatGptConversationEngine: chatGptConversationEngine ?? undefined,
    });

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
        setReaderMarkdownCopyFormulaFormat(next.markdownCopyFormulaFormat);
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
            chatGptConversationEngine,
            pageUrl: window.location.href,
        });
        const snapshot = await buildReaderSessionSnapshot({
            items: itemsResult.items,
            startIndex: itemsResult.startIndex,
            sourceUrl: window.location.href,
            theme: getCurrentAppearance().theme,
        });
        const response = await sendExtRequest({
            v: PROTOCOL_VERSION,
            id: createRequestId(),
            type: 'readerSession:create',
            payload: { snapshot },
        }, { timeoutMs: 12000 });
        if (!response.ok) {
            // Keep this non-blocking; the detached page is an auxiliary speed surface.
            logger.warn('Detached reader open failed', { error: response.error.message });
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
        if (!chatGptConversationEngine) return;
        bindChatGptConversationIndex();
        viewportResizeSuspend?.init();
        chatGptSendPositionRestore?.init();
        chatGptComposerEditing?.init();
        chatGptPromptAutocomplete?.init();
        chatGptMessageStepper?.init();
        chatGptPageWidth?.init();
        syncChatGptBehaviorSettings(settingsClient.getCached()?.chatgptBehavior);
        chatGptConversationEngine.init();
        chatGptLiveDomContent?.init();
        if (!chatGptDirectory) {
            writeDebugState({ ChatGptInit: 'directory-disabled' });
            return;
        }
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
        setAtomicSelectionEnabled(Boolean(runtimeEnabled && next.atomicMarkdownCopy));
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
        chatGptDirectory?.dispose();
        chatGptOfficialNavigationVisibility?.dispose();
        chatGptLiveDomContent?.dispose();
        chatGptConversationEngine?.dispose?.();
        viewportResizeSuspend?.dispose();
        chatGptSendPositionRestore?.dispose();
        chatGptComposerEditing?.dispose();
        chatGptPromptAutocomplete?.dispose();
        chatGptMessageStepper?.dispose();
        chatGptPageWidth?.dispose();
        setAtomicSelectionEnabled(false);
        contentAdapter.dispose?.();
        chatGptConversationIndexBound = false;
    };

    // Apply initial UI locale immediately (otherwise switching to a non-auto locale won't take effect until a change event).
    void setLocale(lastLocale);
    setLazyContentFeatureLocale(lastLocale);
    applyAppearance(initialAppearance);
    if (cachedSettings?.reader) {
        readerPanel.setReaderSettings(cachedSettings.reader);
    }
    readerPanel.setReaderSettingsController({
        onChange: async (patch) => {
            const current = settingsClient.getCached()?.reader ?? DEFAULT_SETTINGS.reader;
            await settingsClient.setCategory('reader', { ...current, ...patch });
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
                    chatGptConversationEngine,
                    pageUrl: window.location.href,
                });
                const snapshot = await buildReaderSessionSnapshot({
                    items: result.items,
                    startIndex: result.startIndex,
                    sourceUrl: window.location.href,
                    theme: getCurrentAppearance().theme,
                });
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
                    ? await navigateChatGPTDirectoryTarget(adapter, {
                        position,
                        messageId: request.payload.messageId ?? null,
                    }, { timeoutMs: 2500, intervalMs: 200 })
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
        if (msg.type === 'readerSession:refresh' || msg.type === 'readerSession:draft' || msg.type === 'readerSession:beforeSend' || msg.type === 'readerSession:send' || msg.type === 'readerSession:locate') {
            void handleDetachedReaderRequest(msg).then((response) => sendResponse?.(response));
            return true;
        }
    });

    if (runtimeEnabled) {
        messageToolbars.init();
        initChatGptIfNeeded();
    }

    if (adapter.getPlatformId() === 'chatgpt') {
        const url = window.location.href.split('#')[0] || window.location.href;
        void bookmarksController.refreshPageBookmarkStatus(url).then((saved) => {
            chatGptMessageStepper?.setPageBookmarked(saved);
        });
    }

    // Best-effort navigation: handle "Go To" from bookmarks panel across SPA transitions.
    const pending = consumePendingNavigation();
    if (pending) {
        const pendingNavigation = adapter.getPlatformId() === 'chatgpt'
            ? navigateChatGPTDirectoryTarget(adapter, pending, { timeoutMs: 8000, intervalMs: 200 })
            : scrollToBookmarkTargetWithRetry(adapter, pending, { timeoutMs: 8000, intervalMs: 200 });
        void pendingNavigation;
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
