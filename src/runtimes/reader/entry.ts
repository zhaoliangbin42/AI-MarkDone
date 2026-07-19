import { PROTOCOL_VERSION, createRequestId, type ReaderSessionSnapshot } from '../../contracts/protocol';
import { DEFAULT_GLOBAL_FONT_SIZE_PX, DEFAULT_SETTINGS, type AppSettings } from '../../core/settings/types';
import { normalizeGlobalFontSizePx, normalizeThemeAccentColor } from '../../core/settings/migrations';
import { sendExtRequest } from '../../drivers/shared/rpc';
import { ensurePageTokens } from '../../style/pageTokens';
import type { UserThemeOverrides } from '../../style/tokens';
import { ReaderPanel } from '../../ui/content/reader/ReaderPanel';
import { createConversationReaderActions } from '../../ui/content/reader/conversationReaderActions';
import { setLocale, t } from '../../ui/content/components/i18n';
import { SendPopover } from '../../ui/content/sending/SendPopover';
import { createDetachedReaderSendPort } from '../../ui/content/sending/detachedReaderSendPort';
import { createPromptLibraryClient } from '../../drivers/content/prompts/promptLibraryClient';
import { ChatGPTPromptAutocompleteController } from '../../ui/content/controllers/ChatGPTPromptAutocompleteController';
import type { ReaderItem } from '../../services/reader/types';
import { setReaderMarkdownCopyFormulaFormat } from '../../services/reader/readerMarkdownCopy';
import { bookmarkSaveDialog } from '../../ui/content/bookmarks/save/bookmarkSaveDialogSingleton';
import { SettingsClient } from '../../drivers/content/settings/settingsClient';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../style/appearance';

type ReaderSessionRecord = {
    sessionId: string;
    sourceTabId: number;
    readerTabId: number | null;
    sourceUrl: string;
    snapshot: ReaderSessionSnapshot;
};

function getSessionId(): string | null {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    return params.get('sessionId');
}

function toReaderItems(snapshot: ReaderSessionSnapshot): ReaderItem[] {
    return snapshot.items.map((item) => ({
        id: item.id,
        userPrompt: item.userPrompt,
        content: item.content,
        meta: item.meta ? { ...item.meta } : undefined,
    }));
}

function applyBookmarkMetadata(items: ReaderItem[], bookmarkedPositions: ReadonlySet<number>): ReaderItem[] {
    return items.map((item) => {
        const position = Number(item.meta?.position ?? 0);
        if (!position) return item;
        return {
            ...item,
            meta: {
                ...(item.meta ?? {}),
                bookmarked: bookmarkedPositions.has(position),
                bookmarkable: true,
            },
        };
    });
}

function getThemeOverrides(settings: AppSettings | null | undefined): UserThemeOverrides {
    const fontSizePx = normalizeGlobalFontSizePx(settings?.appearance?.fontSizePx);
    const accentColor = normalizeThemeAccentColor(settings?.appearance?.accentColor);
    return {
        ...(accentColor ? { accentColor } : {}),
        baseFontScale: fontSizePx / DEFAULT_GLOBAL_FONT_SIZE_PX,
    };
}

function renderStatus(message: string): void {
    document.body.innerHTML = '';
    const root = document.createElement('main');
    root.className = 'detached-reader-status';
    root.textContent = message;
    document.body.appendChild(root);
}

async function loadSettings(): Promise<AppSettings> {
    const response = await sendExtRequest({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'settings:getAll',
    });
    if (response.ok && response.data && typeof response.data === 'object' && 'settings' in response.data) {
        return (response.data as { settings: AppSettings }).settings;
    }
    return DEFAULT_SETTINGS;
}

async function getSession(sessionId: string): Promise<ReaderSessionRecord | null> {
    const response = await sendExtRequest({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'readerSession:get',
        payload: { sessionId },
    });
    if (!response.ok || !response.data || typeof response.data !== 'object') return null;
    return (response.data as { session?: ReaderSessionRecord }).session ?? null;
}

async function closeSession(sessionId: string): Promise<void> {
    await sendExtRequest({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'readerSession:close',
        payload: { sessionId },
    }, { timeoutMs: 4000 });
}

async function readBookmarkedPositions(url: string): Promise<Set<number>> {
    const response = await sendExtRequest({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'bookmarks:positions',
        payload: { url },
    }, { timeoutMs: 4000 });
    if (!response.ok || !response.data || typeof response.data !== 'object') return new Set();
    const positions = (response.data as { positions?: unknown }).positions;
    return Array.isArray(positions)
        ? new Set(positions.map((position) => Number(position)).filter((position) => Number.isFinite(position)))
        : new Set();
}

async function run(): Promise<void> {
    ensurePageTokens();
    const sessionId = getSessionId();
    if (!sessionId) {
        renderStatus('Reader session is missing.');
        return;
    }

    const settingsClient = new SettingsClient();
    let settings = await loadSettings();
    setReaderMarkdownCopyFormulaFormat(settings.formula.markdownCopyFormulaFormat);
    let activeLocale = settings.language ?? DEFAULT_SETTINGS.language;
    await setLocale(activeLocale);
    const panel = new ReaderPanel();
    const sendPopover = new SendPopover();
    const promptLibraryClient = createPromptLibraryClient();
    const promptManager = new ChatGPTPromptAutocompleteController({
        getPlatformId: () => 'reader',
        getComposerInputElement: () => null,
        getComposerKind: () => 'contenteditable',
    } as any, promptLibraryClient);
    let appliedAppearance: AppearanceSnapshot | null = null;
    const applyAppearance = (snapshot: AppearanceSnapshot): void => {
        document.documentElement.setAttribute('data-aimd-theme', snapshot.theme);
        if (appliedAppearance && areAppearanceSnapshotsEqual(appliedAppearance, snapshot)) return;
        appliedAppearance = snapshot;
        ensurePageTokens(snapshot.overrides);
        panel.setAppearance(snapshot);
        promptManager.setAppearance(snapshot);
        sendPopover.setAppearance(snapshot);
        bookmarkSaveDialog.setAppearance(snapshot);
    };
    const listReaderPromptsFromLibrary = async () => {
        const prompts = await promptLibraryClient.listPrompts({ context: 'readerComment' });
        return prompts.map((prompt) => ({
            id: prompt.id,
            title: prompt.title,
            content: prompt.content,
        }));
    };
    sendPopover.setPromptAutocompleteController(promptManager);
    promptManager.setEnabled(Boolean(settings.chatgptBehavior?.promptAutocomplete ?? DEFAULT_SETTINGS.chatgptBehavior.promptAutocomplete));
    panel.setReaderSettings(settings.reader);
    panel.setReaderSettingsController({
        onChange: async (patch) => {
            settings = {
                ...settings,
                reader: {
                    ...settings.reader,
                    ...patch,
                    commentExport: patch.commentExport ?? settings.reader.commentExport,
                },
            };
            applyAppearance(createAppearanceSnapshot(session?.snapshot.theme ?? 'light', getThemeOverrides(settings)));
            await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'settings:setCategory',
                payload: { category: 'reader', value: settings.reader },
            });
        },
    });
    panel.setPromptManagerController({
        onOpenManager: (anchor) => promptManager.openManager(anchor),
        listReaderPrompts: listReaderPromptsFromLibrary,
    });

    let session = await getSession(sessionId);
    if (!session) {
        renderStatus(t('detachedReaderSessionExpired'));
        return;
    }

    const unsubscribeSettings = settingsClient.subscribe((snapshot) => {
        settings = snapshot.settings;
        const nextLocale = settings.language ?? DEFAULT_SETTINGS.language;
        if (nextLocale !== activeLocale) {
            activeLocale = nextLocale;
            void setLocale(nextLocale);
        }
        applyAppearance(createAppearanceSnapshot(session?.snapshot.theme ?? 'light', getThemeOverrides(settings)));
    });
    let settingsDisposed = false;
    const disposeSettingsBackflow = (): void => {
        if (settingsDisposed) return;
        settingsDisposed = true;
        unsubscribeSettings();
        window.removeEventListener('pagehide', disposeSettingsBackflow);
    };
    window.addEventListener('pagehide', disposeSettingsBackflow, { once: true });
    settingsClient.init();

    const showSession = async (): Promise<void> => {
        if (!session) return;
        const bookmarkedPositions = await readBookmarkedPositions(session.snapshot.sourceUrl);
        const detachedSendPort = createDetachedReaderSendPort(sessionId);
        const items = applyBookmarkMetadata(toReaderItems(session.snapshot), bookmarkedPositions);
        const actions = createConversationReaderActions({
            refresh: {
                refresh: async (ctx) => {
                    const response = await sendExtRequest({
                        v: PROTOCOL_VERSION,
                        id: createRequestId(),
                        type: 'readerSession:refresh',
                        payload: { sessionId },
                    }, { timeoutMs: 12000 });
                    if (!response.ok || !response.data || typeof response.data !== 'object') {
                        ctx.notify(response.ok ? t('detachedReaderSourceUnavailable') : response.error.message);
                        return;
                    }
                    const refreshedSession = (response.data as { session?: ReaderSessionRecord }).session ?? session;
                    if (!refreshedSession) {
                        ctx.notify(t('detachedReaderSourceUnavailable'));
                        return;
                    }
                    session = refreshedSession;
                    const refreshedBookmarkedPositions = await readBookmarkedPositions(refreshedSession.snapshot.sourceUrl);
                    bookmarkedPositions.clear();
                    refreshedBookmarkedPositions.forEach((position) => bookmarkedPositions.add(position));
                    const refreshedItems = applyBookmarkMetadata(toReaderItems(refreshedSession.snapshot), bookmarkedPositions);
                    applyAppearance(createAppearanceSnapshot(refreshedSession.snapshot.theme, getThemeOverrides(settings)));
                    await panel.replaceItems(refreshedItems, { preserveCurrentIdentity: true });
                    ctx.notify(t('detachedReaderRefreshed'));
                },
            },
            bookmark: {
                resolveUrl: () => session?.snapshot.sourceUrl ?? window.location.href,
                isBookmarked: (url, position) => {
                    if (!session) return false;
                    if (url !== session.snapshot.sourceUrl) return false;
                    return bookmarkedPositions.has(position);
                },
                toggle: async (input) => {
                    const position = Number(input.position || 0);
                    if (!position) return { ok: false, message: t('positionNotAvailable') };
                    const userPrompt = input.userPrompt.trim();
                    if (!userPrompt) return { ok: false, message: t('failedToExtractUserMessage') };
                    if (input.alreadyBookmarked) {
                        const response = await sendExtRequest({
                            v: PROTOCOL_VERSION,
                            id: createRequestId(),
                            type: 'bookmarks:remove',
                            payload: { url: input.url, position },
                        }, { timeoutMs: 4000 });
                        if (!response.ok) return { ok: false, message: response.error.message };
                        bookmarkedPositions.delete(position);
                        return { ok: true, bookmarked: false, message: t('removedStatus') };
                    }
                    const dialogResult = await bookmarkSaveDialog.open({
                        theme: session?.snapshot.theme ?? 'light',
                        userPrompt,
                        existingTitle: userPrompt,
                        currentFolderPath: null,
                        mode: 'create',
                    });
                    if (!dialogResult.ok) return { ok: false, cancelled: true };
                    const response = await sendExtRequest({
                        v: PROTOCOL_VERSION,
                        id: createRequestId(),
                        type: 'bookmarks:save',
                        payload: {
                            url: input.url,
                            position,
                            messageId: input.messageId,
                            userMessage: userPrompt,
                            aiResponse: input.markdown,
                            platform: 'ChatGPT',
                            title: dialogResult.title,
                            folderPath: dialogResult.folderPath,
                        },
                    }, { timeoutMs: 4000 });
                    if (!response.ok) return { ok: false, message: response.error.message };
                    bookmarkedPositions.add(position);
                    return { ok: true, bookmarked: true, message: t('savedStatus') };
                },
            },
            send: {
                open: async (ctx) => {
                    const shadow = ctx.shadow;
                    const anchorBtn = ctx.anchorEl;
                    if (!shadow || !anchorBtn || !session) return;
                    const anchorWrap = anchorBtn.closest?.('[data-role="footer-left-actions"]') as HTMLElement | null;
                    sendPopover.toggle({
                        sendPort: detachedSendPort,
                        shadow,
                        anchor: anchorWrap || anchorBtn,
                        theme: session.snapshot.theme,
                        commentInsert: panel.getCommentExportContext(),
                    });
                },
            },
            locate: {
                locate: async ({ position, messageId }) => {
                    const response = await sendExtRequest({
                        v: PROTOCOL_VERSION,
                        id: createRequestId(),
                        type: 'readerSession:locate',
                        payload: { sessionId, position, messageId },
                    }, { timeoutMs: 12000 });
                    return response.ok
                        ? { ok: true, message: t('detachedReaderLocated') }
                        : { ok: false, message: response.error.message };
                },
            },
        });

        const snapshot = session.snapshot;
        applyAppearance(createAppearanceSnapshot(snapshot.theme, getThemeOverrides(settings)));
        await panel.show(items, snapshot.startIndex, snapshot.theme, {
            profile: 'conversation-reader',
            actions,
            onRequestClose: async () => {
                disposeSettingsBackflow();
                panel.hide();
                await closeSession(sessionId);
                window.close();
                renderStatus(t('detachedReaderClosed'));
            },
        });
    };

    await showSession();
}

void run().catch((error) => {
    renderStatus(error instanceof Error ? error.message : 'Detached reader failed to start.');
});
