import { afterEach, describe, expect, it, vi } from 'vitest';

const ensurePageTokens = vi.fn();
const sendExtRequest = vi.fn();
const setLocale = vi.fn(async () => undefined);
const subscribeLocaleChange = vi.fn(() => undefined);
const t = vi.fn((key: string) => key);
const panelSetTheme = vi.fn();
const panelSetThemeOverrides = vi.fn();
const panelSetReaderSettings = vi.fn();
const panelSetReaderSettingsController = vi.fn();
const panelSetPromptManagerController = vi.fn();
const panelGetCommentExportContext = vi.fn(() => null);
const panelShow = vi.fn(async () => undefined);
const bookmarkSaveDialogOpen = vi.fn(async () => ({ ok: true, title: 'Saved title', folderPath: 'Saved/Folder' }));
const bookmarkSaveDialogSetTheme = vi.fn();
const bookmarkSaveDialogSetThemeOverrides = vi.fn();
const readerPanelCtor = vi.fn(function () {
    return {
        setTheme: panelSetTheme,
        setThemeOverrides: panelSetThemeOverrides,
        setReaderSettings: panelSetReaderSettings,
        setReaderSettingsController: panelSetReaderSettingsController,
        setPromptManagerController: panelSetPromptManagerController,
        getCommentExportContext: panelGetCommentExportContext,
        show: panelShow,
        hide: vi.fn(),
    };
});

vi.mock('@/style/pageTokens', () => ({
    ensurePageTokens,
}));

vi.mock('@/drivers/shared/rpc', () => ({
    sendExtRequest,
}));

vi.mock('@/ui/content/components/i18n', () => ({
    subscribeLocaleChange,
    setLocale,
    t,
}));

vi.mock('@/ui/content/reader/ReaderPanel', () => ({
    ReaderPanel: readerPanelCtor,
}));

vi.mock('@/ui/content/bookmarks/save/bookmarkSaveDialogSingleton', () => ({
    bookmarkSaveDialog: {
        open: bookmarkSaveDialogOpen,
        setTheme: bookmarkSaveDialogSetTheme,
        setThemeOverrides: bookmarkSaveDialogSetThemeOverrides,
    },
}));

afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.documentElement.removeAttribute('data-aimd-theme');
    window.location.hash = '';
    document.body.innerHTML = '';
});

describe('detached reader runtime entry', () => {
    it('syncs the extension page theme and token overrides from the reader session snapshot', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        const settings = {
            ...DEFAULT_SETTINGS,
            language: 'en',
            appearance: {
                ...DEFAULT_SETTINGS.appearance,
                fontSizePx: 18,
                accentColor: '#2563eb',
            },
            reader: {
                ...DEFAULT_SETTINGS.reader,
                bodyFontSizePx: 19,
                contentMaxWidthPx: 1180,
            },
        };
        const session = {
            sessionId: 'session-1',
            sourceTabId: 10,
            readerTabId: 11,
            sourceUrl: 'https://chatgpt.com/c/mock',
            snapshot: {
                items: [{ id: 'item-1', userPrompt: 'Prompt', content: 'Answer' }],
                startIndex: 0,
                sourceUrl: 'https://chatgpt.com/c/mock',
                theme: 'dark',
                createdAt: 1,
                updatedAt: 1,
            },
        };
        window.location.hash = '#sessionId=session-1';
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'settings:getAll') {
                return { ok: true, data: { settings } };
            }
            if (request.type === 'readerSession:get') {
                return { ok: true, data: { session } };
            }
            if (request.type === 'readerSession:draft') {
                return { ok: true, data: { text: 'source composer draft' } };
            }
            if (request.type === 'prompts:list') {
                return {
                    ok: true,
                    data: {
                        prompts: [
                            {
                                id: 'rewrite',
                                title: 'Rewrite Clearly',
                                content: 'Rewrite this clearly:\n{{cursor}}',
                                triggerText: 'rewrite',
                                contexts: ['composer', 'readerComment'],
                                favorite: false,
                                enabled: true,
                                createdAt: 1,
                                updatedAt: 1,
                                lastUsedAt: null,
                            },
                        ],
                    },
                };
            }
            return { ok: true, data: {} };
        });

        await import('@/runtimes/reader/entry');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(document.documentElement.getAttribute('data-aimd-theme')).toBe('dark');
        expect(ensurePageTokens).toHaveBeenLastCalledWith(expect.objectContaining({
            accentColor: '#2563eb',
            baseFontScale: 18 / 16,
            readerBodyFontSizePx: 19,
            readerContentWidthPx: 1180,
        }));
        expect(panelSetTheme).toHaveBeenCalledWith('dark');
        expect(panelSetThemeOverrides).toHaveBeenLastCalledWith(expect.objectContaining({
            accentColor: '#2563eb',
            readerBodyFontSizePx: 19,
            readerContentWidthPx: 1180,
        }));
        expect(panelShow).toHaveBeenCalledWith(
            [{ id: 'item-1', userPrompt: 'Prompt', content: 'Answer', meta: undefined }],
            0,
            'dark',
            expect.objectContaining({ profile: 'conversation-reader' }),
        );
    });

    it('wires detached Reader Prompt settings to the shared Prompt manager', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        const settings = { ...DEFAULT_SETTINGS, language: 'en' };
        const session = {
            sessionId: 'session-1',
            sourceTabId: 10,
            readerTabId: 11,
            sourceUrl: 'https://chatgpt.com/c/mock',
            snapshot: {
                items: [{ id: 'item-1', userPrompt: 'Prompt', content: 'Answer' }],
                startIndex: 0,
                sourceUrl: 'https://chatgpt.com/c/mock',
                theme: 'light',
                createdAt: 1,
                updatedAt: 1,
            },
        };
        window.location.hash = '#sessionId=session-1';
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'settings:getAll') {
                return { ok: true, data: { settings } };
            }
            if (request.type === 'readerSession:get') {
                return { ok: true, data: { session } };
            }
            if (request.type === 'readerSession:draft') {
                return { ok: true, data: { text: 'source composer draft' } };
            }
            if (request.type === 'prompts:list') {
                return {
                    ok: true,
                    data: {
                        prompts: [
                            {
                                id: 'prompt-1',
                                title: 'Reader shared prompt',
                                content: 'Please review this.',
                                triggerText: 'review',
                                contexts: ['composer', 'readerComment'],
                                favorite: false,
                                enabled: true,
                                createdAt: 1,
                                updatedAt: 1,
                                lastUsedAt: null,
                            },
                        ],
                    },
                };
            }
            return { ok: true, data: {} };
        });

        await import('@/runtimes/reader/entry');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(panelSetPromptManagerController).toHaveBeenCalledWith(expect.objectContaining({
            onOpenManager: expect.any(Function),
            listReaderPrompts: expect.any(Function),
        }));

        const readerPrompts = await panelSetPromptManagerController.mock.calls[0][0].listReaderPrompts();
        expect(readerPrompts).toEqual([
            { id: 'prompt-1', title: 'Reader shared prompt', content: 'Please review this.' },
        ]);
        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'prompts:list',
            payload: { context: 'readerComment' },
        }));

        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        await panelSetPromptManagerController.mock.calls[0][0].onOpenManager(anchor);
        await Promise.resolve();

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'prompts:list',
            payload: { context: 'all', includeDisabled: true },
        }));
        const host = document.getElementById('aimd-chatgpt-prompt-popover-host')!;
        expect(host).toBeTruthy();
        expect(host.shadowRoot?.querySelector('[data-action="insert-prompt"]')).toBeNull();
    });

    it('opens the shared send popover for detached send instead of using a native prompt', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        const settings = { ...DEFAULT_SETTINGS, language: 'en' };
        const session = {
            sessionId: 'session-1',
            sourceTabId: 10,
            readerTabId: 11,
            sourceUrl: 'https://chatgpt.com/c/mock',
            snapshot: {
                items: [{ id: 'item-1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } }],
                startIndex: 0,
                sourceUrl: 'https://chatgpt.com/c/mock',
                theme: 'light',
                createdAt: 1,
                updatedAt: 1,
            },
        };
        window.location.hash = '#sessionId=session-1';
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'settings:getAll') {
                return { ok: true, data: { settings } };
            }
            if (request.type === 'readerSession:get') {
                return { ok: true, data: { session } };
            }
            if (request.type === 'readerSession:draft') {
                return { ok: true, data: { text: 'source composer draft' } };
            }
            if (request.type === 'prompts:list') {
                return {
                    ok: true,
                    data: {
                        prompts: [
                            {
                                id: 'rewrite',
                                title: 'Rewrite Clearly',
                                content: 'Rewrite this clearly:\n{{cursor}}',
                                triggerText: 'rewrite',
                                contexts: ['composer', 'readerComment'],
                                favorite: false,
                                enabled: true,
                                createdAt: 1,
                                updatedAt: 1,
                                lastUsedAt: null,
                            },
                        ],
                    },
                };
            }
            return { ok: true, data: {} };
        });
        const promptSpy = vi.spyOn(window, 'prompt');

        await import('@/runtimes/reader/entry');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const options = panelShow.mock.calls[0][3];
        const sendAction = options.actions.find((action: any) => action.id === 'send');
        expect(sendAction).toBeTruthy();

        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);
        const button = document.createElement('button');
        footerLeft.appendChild(button);

        await sendAction.onClick({
            item: { id: 'item-1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } },
            index: 0,
            items: [],
            shadow,
            anchorEl: button,
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(promptSpy).not.toHaveBeenCalled();
        await Promise.resolve();
        await Promise.resolve();
        const popover = footerLeft.querySelector<HTMLElement>('.send-popover');
        expect(popover).toBeTruthy();
        const input = popover!.querySelector<HTMLTextAreaElement>('[data-role="text"]')!;
        expect(input.value).toBe('source composer draft');
        input.value = '\\re';
        input.setSelectionRange(input.value.length, input.value.length);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const promptHost = document.getElementById('aimd-chatgpt-prompt-popover-host');
        expect(promptHost?.shadowRoot?.querySelector('[data-role="prompt-suggestion"]')?.textContent).toContain('Rewrite Clearly');

        input.value = 'hello from detached';
        popover!.querySelector<HTMLButtonElement>('[data-action="send"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:beforeSend',
            payload: { sessionId: 'session-1' },
        }), { timeoutMs: 4000 });
        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:send',
            payload: { sessionId: 'session-1', text: 'hello from detached' },
        }), { timeoutMs: 12000 });
    });

    it('syncs detached send popover draft edits back to the source composer when closed', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        const settings = { ...DEFAULT_SETTINGS, language: 'en' };
        const session = {
            sessionId: 'session-1',
            sourceTabId: 10,
            readerTabId: 11,
            sourceUrl: 'https://chatgpt.com/c/mock',
            snapshot: {
                items: [{ id: 'item-1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } }],
                startIndex: 0,
                sourceUrl: 'https://chatgpt.com/c/mock',
                theme: 'light',
                createdAt: 1,
                updatedAt: 1,
            },
        };
        window.location.hash = '#sessionId=session-1';
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'settings:getAll') {
                return { ok: true, data: { settings } };
            }
            if (request.type === 'readerSession:get') {
                return { ok: true, data: { session } };
            }
            if (request.type === 'readerSession:draft' && typeof request.payload.text === 'string') {
                return { ok: true, data: { written: true } };
            }
            if (request.type === 'readerSession:draft') {
                return { ok: true, data: { text: 'source composer draft' } };
            }
            return { ok: true, data: {} };
        });

        await import('@/runtimes/reader/entry');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const options = panelShow.mock.calls[0][3];
        const sendAction = options.actions.find((action: any) => action.id === 'send');
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);
        const button = document.createElement('button');
        footerLeft.appendChild(button);

        await sendAction.onClick({
            item: { id: 'item-1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } },
            index: 0,
            items: [],
            shadow,
            anchorEl: button,
            notify: vi.fn(),
            rerender: vi.fn(),
        });
        await Promise.resolve();
        await Promise.resolve();

        const popover = footerLeft.querySelector<HTMLElement>('.send-popover')!;
        const input = popover.querySelector<HTMLTextAreaElement>('[data-role="text"]')!;
        input.value = 'edited detached draft';
        popover.querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:draft',
            payload: { sessionId: 'session-1', text: 'edited detached draft' },
        }), { timeoutMs: 4000 });
    });

    it('renders bookmark actions in detached reader and toggles through the shared bookmarks protocol', async () => {
        const { DEFAULT_SETTINGS } = await import('@/core/settings/types');
        const settings = { ...DEFAULT_SETTINGS, language: 'en' };
        const session = {
            sessionId: 'session-1',
            sourceTabId: 10,
            readerTabId: 11,
            sourceUrl: 'https://chatgpt.com/c/mock',
            snapshot: {
                items: [
                    {
                        id: 'item-1',
                        userPrompt: 'Prompt',
                        content: 'Answer',
                        meta: {
                            position: 1,
                            messageId: 'assistant-1',
                            url: 'https://chatgpt.com/c/mock',
                        },
                    },
                ],
                startIndex: 0,
                sourceUrl: 'https://chatgpt.com/c/mock',
                theme: 'light',
                createdAt: 1,
                updatedAt: 1,
            },
        };
        window.location.hash = '#sessionId=session-1';
        sendExtRequest.mockImplementation(async (request: any) => {
            if (request.type === 'settings:getAll') {
                return { ok: true, data: { settings } };
            }
            if (request.type === 'readerSession:get') {
                return { ok: true, data: { session } };
            }
            if (request.type === 'bookmarks:positions') {
                return { ok: true, data: { positions: [1] } };
            }
            if (request.type === 'bookmarks:remove') {
                return { ok: true, data: { removed: 1 } };
            }
            if (request.type === 'bookmarks:save') {
                return { ok: true, data: { warnings: [] } };
            }
            return { ok: true, data: {} };
        });

        await import('@/runtimes/reader/entry');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(panelShow).toHaveBeenCalledWith(
            [expect.objectContaining({
                id: 'item-1',
                meta: expect.objectContaining({
                    position: 1,
                    bookmarked: true,
                    bookmarkable: true,
                }),
            })],
            0,
            'light',
            expect.any(Object),
        );

        const options = panelShow.mock.calls[0][3];
        const bookmarkAction = options.actions.find((action: any) => action.id === 'bookmark_toggle');
        expect(bookmarkAction).toBeTruthy();

        const notify = vi.fn();
        const rerender = vi.fn();
        const item = {
            id: 'item-1',
            userPrompt: 'Prompt',
            content: 'Answer',
            meta: {
                position: 1,
                messageId: 'assistant-1',
                url: 'https://chatgpt.com/c/mock',
                bookmarked: true,
            },
        };
        await bookmarkAction.onClick({
            item,
            index: 0,
            items: [item],
            notify,
            rerender,
        });

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'bookmarks:remove',
            payload: { url: 'https://chatgpt.com/c/mock', position: 1 },
        }), { timeoutMs: 4000 });
        expect(item.meta.bookmarked).toBe(false);
        expect(notify).toHaveBeenCalledWith('removedStatus');
        expect(rerender).toHaveBeenCalled();

        await bookmarkAction.onClick({
            item,
            index: 0,
            items: [item],
            notify,
            rerender,
        });

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'bookmarks:save',
            payload: expect.objectContaining({
                url: 'https://chatgpt.com/c/mock',
                position: 1,
                messageId: 'assistant-1',
                userMessage: 'Prompt',
                aiResponse: 'Answer',
                platform: 'ChatGPT',
                title: 'Saved title',
                folderPath: 'Saved/Folder',
            }),
        }), { timeoutMs: 4000 });
        expect(bookmarkSaveDialogOpen).toHaveBeenCalledWith(expect.objectContaining({
            theme: 'light',
            userPrompt: 'Prompt',
            existingTitle: 'Prompt',
            mode: 'create',
        }));
        expect(item.meta.bookmarked).toBe(true);
        expect(notify).toHaveBeenCalledWith('savedStatus');
    });
});
