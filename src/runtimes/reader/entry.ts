import { PROTOCOL_VERSION, createRequestId, type ReaderSessionSnapshot } from '../../contracts/protocol';
import { DEFAULT_GLOBAL_FONT_SIZE_PX, DEFAULT_SETTINGS, type AppSettings } from '../../core/settings/types';
import { normalizeGlobalFontSizePx, normalizeThemeAccentColor } from '../../core/settings/migrations';
import { sendExtRequest } from '../../drivers/shared/rpc';
import { ensurePageTokens } from '../../style/pageTokens';
import type { UserThemeOverrides } from '../../style/tokens';
import { ReaderPanel } from '../../ui/content/reader/ReaderPanel';
import { createConversationReaderActions } from '../../ui/content/reader/conversationReaderActions';
import { setLocale, t } from '../../ui/content/components/i18n';
import { SendPopover, type SendPort } from '../../ui/content/sending/SendPopover';
import type { ReaderItem } from '../../services/reader/types';
import { bookmarkSaveDialog } from '../../ui/content/bookmarks/save/bookmarkSaveDialogSingleton';

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

function getThemeOverrides(settings: AppSettings | null | undefined): UserThemeOverrides {
    const fontSizePx = normalizeGlobalFontSizePx(settings?.appearance?.fontSizePx);
    const accentColor = normalizeThemeAccentColor(settings?.appearance?.accentColor);
    return {
        ...(accentColor ? { accentColor } : {}),
        baseFontScale: fontSizePx / DEFAULT_GLOBAL_FONT_SIZE_PX,
        readerContentWidthPx: settings?.reader?.contentMaxWidthPx ?? DEFAULT_SETTINGS.reader.contentMaxWidthPx,
        readerBodyFontSizePx: settings?.reader?.bodyFontSizePx ?? DEFAULT_SETTINGS.reader.bodyFontSizePx,
    };
}

function renderStatus(message: string): void {
    document.body.innerHTML = '';
    const root = document.createElement('main');
    root.className = 'detached-reader-status';
    root.textContent = message;
    document.body.appendChild(root);
}

function syncDetachedReaderTheme(theme: ReaderSessionSnapshot['theme'], settings: AppSettings): UserThemeOverrides {
    document.documentElement.setAttribute('data-aimd-theme', theme);
    const overrides = getThemeOverrides(settings);
    ensurePageTokens(overrides);
    return overrides;
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

async function readSourceDraft(sessionId: string): Promise<string> {
    const response = await sendExtRequest({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'readerSession:draft',
        payload: { sessionId },
    }, { timeoutMs: 4000 });
    if (!response.ok || !response.data || typeof response.data !== 'object') return '';
    const text = (response.data as { text?: unknown }).text;
    return typeof text === 'string' ? text : '';
}

async function writeSourceDraft(sessionId: string, text: string): Promise<void> {
    await sendExtRequest({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'readerSession:draft',
        payload: { sessionId, text },
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

    let settings = await loadSettings();
    await setLocale(settings.language ?? DEFAULT_SETTINGS.language);
    let currentThemeOverrides = getThemeOverrides(settings);
    ensurePageTokens(currentThemeOverrides);

    const panel = new ReaderPanel();
    const sendPopover = new SendPopover();
    panel.setThemeOverrides(currentThemeOverrides);
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
            currentThemeOverrides = syncDetachedReaderTheme(session?.snapshot.theme ?? 'light', settings);
            panel.setThemeOverrides(currentThemeOverrides);
            await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'settings:setCategory',
                payload: { category: 'reader', value: settings.reader },
            });
        },
    });

    let session = await getSession(sessionId);
    if (!session) {
        renderStatus(t('detachedReaderSessionExpired'));
        return;
    }

    const showSession = async (): Promise<void> => {
        if (!session) return;
        const bookmarkedPositions = await readBookmarkedPositions(session.snapshot.sourceUrl);
        const detachedSendPort: SendPort = {
            readDraft: () => readSourceDraft(sessionId),
            writeDraft: async (text) => {
                await writeSourceDraft(sessionId, text);
            },
            submit: async (text) => {
                const response = await sendExtRequest({
                    v: PROTOCOL_VERSION,
                    id: createRequestId(),
                    type: 'readerSession:send',
                    payload: { sessionId, text },
                }, { timeoutMs: 12000 });
                return response.ok
                    ? { ok: true }
                    : { ok: false, message: response.error.message };
            },
        };
        const items = toReaderItems(session.snapshot).map((item) => {
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
                    session = (response.data as { session?: ReaderSessionRecord }).session ?? session;
                    ctx.notify(t('detachedReaderRefreshed'));
                    await showSession();
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
                    bookmarkSaveDialog.setTheme(session?.snapshot.theme ?? 'light');
                    bookmarkSaveDialog.setThemeOverrides(currentThemeOverrides);
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
        currentThemeOverrides = syncDetachedReaderTheme(snapshot.theme, settings);
        panel.setTheme(snapshot.theme);
        panel.setThemeOverrides(currentThemeOverrides);
        await panel.show(items, snapshot.startIndex, snapshot.theme, {
            profile: 'conversation-reader',
            actions,
            onRequestClose: async () => {
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
