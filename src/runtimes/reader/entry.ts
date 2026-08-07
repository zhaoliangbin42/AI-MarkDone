import { PROTOCOL_VERSION, createRequestId, type ReaderSessionSnapshot } from '../../contracts/protocol';
import { isReaderAnnotationDocument } from '../../contracts/readerAnnotations';
import { DEFAULT_GLOBAL_FONT_SIZE_PX, DEFAULT_SETTINGS, type AppSettings } from '../../core/settings/types';
import { normalizeGlobalFontSizePx, normalizeThemeAccentColor } from '../../core/settings/migrations';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    RuntimeClientRequestError,
} from '../../drivers/shared/clients/clientResult';
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
import { setCanonicalMarkdownCopyFormulaFormat } from '../../services/copy/canonicalMarkdownCopy';
import { bookmarkSaveDialog } from '../../ui/content/bookmarks/save/bookmarkSaveDialogSingleton';
import { SettingsClient } from '../../drivers/content/settings/settingsClient';
import { hasFields, isRecord, readArrayField } from '../../drivers/shared/clients/payloadValidation';
import { bookmarksClient } from '../../drivers/shared/clients/bookmarksClient';
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

function isOptionalNullableString(value: unknown): boolean {
    return value === undefined || value === null || typeof value === 'string';
}

function isReaderSessionItemMeta(value: unknown): boolean {
    if (!isRecord(value)) return false;
    if (!['platformId', 'url'].every((field) => value[field] === undefined || typeof value[field] === 'string')) return false;
    if (!['messageId', 'roundId', 'userMessageId', 'assistantMessageId', 'branchKey']
        .every((field) => isOptionalNullableString(value[field]))) return false;
    if (value.position !== undefined && (typeof value.position !== 'number' || !Number.isFinite(value.position))) return false;
    if (value.bookmarkable !== undefined && typeof value.bookmarkable !== 'boolean') return false;
    return value.bookmarked === undefined || typeof value.bookmarked === 'boolean';
}

function isReaderSessionSnapshot(value: unknown): value is ReaderSessionSnapshot {
    if (!hasFields(value, ['sourceUrl'], ['startIndex', 'createdAt', 'updatedAt'])) return false;
    const items = readArrayField(value, 'items', (item) => (
        hasFields(item, ['id', 'userPrompt', 'content'])
        && (item.meta === undefined || isReaderSessionItemMeta(item.meta))
    ));
    if (!items) return false;
    return typeof value.startIndex === 'number'
        && Number.isInteger(value.startIndex)
        && value.startIndex >= 0
        && typeof value.sourceUrl === 'string'
        && (value.theme === 'light' || value.theme === 'dark')
        && typeof value.createdAt === 'number'
        && Number.isFinite(value.createdAt)
        && typeof value.updatedAt === 'number'
        && Number.isFinite(value.updatedAt)
        && (value.annotationDocument === undefined || isReaderAnnotationDocument(value.annotationDocument));
}

function isReaderSessionRecord(value: unknown): value is ReaderSessionRecord {
    return hasFields(value, ['sessionId', 'sourceUrl'], ['sourceTabId'])
        && Number.isInteger(value.sourceTabId)
        && (value.readerTabId === null || (typeof value.readerTabId === 'number' && Number.isInteger(value.readerTabId)))
        && isReaderSessionSnapshot(value.snapshot);
}

function invalidPayloadError(message: string): RuntimeClientRequestError {
    return new RuntimeClientRequestError(createInvalidResponseClientFailure(message).failure);
}

function decodeReaderSessionPayload(
    data: unknown,
    requestType: 'readerSession:get' | 'readerSession:refresh',
    options: { allowNull: boolean },
): ReaderSessionRecord | null {
    if (!isRecord(data) || !Object.prototype.hasOwnProperty.call(data, 'session')) {
        throw invalidPayloadError(`Invalid ${requestType} response payload`);
    }
    if (data.session === null && options.allowNull) return null;
    if (!isReaderSessionRecord(data.session)) {
        throw invalidPayloadError(`Invalid ${requestType} response payload`);
    }
    return data.session;
}

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
    const response = await requestRuntimeClient<{ settings?: unknown }>({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'settings:getAll',
    });
    if (!response.ok) throw new RuntimeClientRequestError(response.failure);
    if (!response.data?.settings || typeof response.data.settings !== 'object') {
        throw new Error('Settings response is invalid.');
    }
    return response.data.settings as AppSettings;
}

async function getSession(sessionId: string): Promise<ReaderSessionRecord | null> {
    const response = await requestRuntimeClient<unknown>({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'readerSession:get',
        payload: { sessionId },
    });
    if (!response.ok) throw new RuntimeClientRequestError(response.failure);
    return decodeReaderSessionPayload(response.data, 'readerSession:get', { allowNull: true });
}

async function closeSession(sessionId: string): Promise<void> {
    const response = await requestRuntimeClient({
        v: PROTOCOL_VERSION,
        id: createRequestId(),
        type: 'readerSession:close',
        payload: { sessionId },
    }, { timeoutMs: 4000 });
    if (!response.ok) throw new RuntimeClientRequestError(response.failure);
}

async function readBookmarkedPositions(url: string): Promise<Set<number>> {
    const response = await bookmarksClient.positions({ url });
    if (!response.ok) throw new RuntimeClientRequestError(response.failure);
    return new Set(response.data.positions);
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
    setCanonicalMarkdownCopyFormulaFormat(settings.formula.markdownCopyFormulaFormat);
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
    let readerSettingsWriteQueue: Promise<void> = Promise.resolve();
    panel.setReaderSettingsController({
        onChange: (patch) => {
            const write = readerSettingsWriteQueue.then(async () => {
                const nextSettings = {
                    ...settings,
                    reader: {
                        ...settings.reader,
                        ...patch,
                        commentExport: patch.commentExport ?? settings.reader.commentExport,
                    },
                };
                const response = await settingsClient.setCategoryResult('reader', nextSettings.reader);
                if (!response.ok) {
                    panel.setReaderSettings(settings.reader);
                    throw new RuntimeClientRequestError(response.failure);
                }
                settings = nextSettings;
                panel.setReaderSettings(settings.reader);
                applyAppearance(createAppearanceSnapshot(session?.snapshot.theme ?? 'light', getThemeOverrides(settings)));
            });
            readerSettingsWriteQueue = write.catch(() => undefined);
            return write;
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
                    const response = await requestRuntimeClient<unknown>({
                        v: PROTOCOL_VERSION,
                        id: createRequestId(),
                        type: 'readerSession:refresh',
                        payload: { sessionId },
                    }, { timeoutMs: 12000 });
                    if (!response.ok) {
                        ctx.notify(response.message);
                        return;
                    }
                    const refreshedSession = decodeReaderSessionPayload(
                        response.data,
                        'readerSession:refresh',
                        { allowNull: false },
                    );
                    if (!refreshedSession) throw invalidPayloadError('Invalid readerSession:refresh response payload');
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
                    const canonical = await bookmarksClient.positions({ url: input.url });
                    if (!canonical.ok) return { ok: false, message: canonical.message };
                    const alreadyBookmarked = canonical.data.positions.includes(position);
                    if (alreadyBookmarked) {
                        const response = await bookmarksClient.remove({ url: input.url, position });
                        if (!response.ok) return { ok: false, message: response.message };
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
                    const response = await bookmarksClient.save({
                        url: input.url,
                        position,
                        messageId: input.messageId,
                        userMessage: userPrompt,
                        aiResponse: input.markdown,
                        platform: 'ChatGPT',
                        title: dialogResult.title,
                        folderPath: dialogResult.folderPath,
                    });
                    if (!response.ok) return { ok: false, message: response.message };
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
                    const response = await requestRuntimeClient({
                        v: PROTOCOL_VERSION,
                        id: createRequestId(),
                        type: 'readerSession:locate',
                        payload: { sessionId, position, messageId },
                    }, { timeoutMs: 12000 });
                    return response.ok
                        ? { ok: true, message: t('detachedReaderLocated') }
                        : { ok: false, message: response.message };
                },
            },
        });

        const snapshot = session.snapshot;
        applyAppearance(createAppearanceSnapshot(snapshot.theme, getThemeOverrides(settings)));
        await panel.show(items, snapshot.startIndex, snapshot.theme, {
            profile: 'conversation-reader',
            annotationDocument: snapshot.annotationDocument,
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
