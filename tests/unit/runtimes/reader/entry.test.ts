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
const panelGetCommentExportContext = vi.fn(() => null);
const panelShow = vi.fn(async () => undefined);
const readerPanelCtor = vi.fn(function () {
    return {
        setTheme: panelSetTheme,
        setThemeOverrides: panelSetThemeOverrides,
        setReaderSettings: panelSetReaderSettings,
        setReaderSettingsController: panelSetReaderSettingsController,
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
        const shadow = host.attachShadow({ mode: 'open' });
        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);
        const button = document.createElement('button');
        footerLeft.appendChild(button);

        sendAction.onClick({
            item: { id: 'item-1', userPrompt: 'Prompt', content: 'Answer', meta: { position: 1 } },
            index: 0,
            items: [],
            shadow,
            anchorEl: button,
            notify: vi.fn(),
            rerender: vi.fn(),
        });

        expect(promptSpy).not.toHaveBeenCalled();
        const popover = footerLeft.querySelector<HTMLElement>('.send-popover');
        expect(popover).toBeTruthy();
        const input = popover!.querySelector<HTMLTextAreaElement>('[data-role="text"]')!;
        input.value = 'hello from detached';
        popover!.querySelector<HTMLButtonElement>('[data-action="send"]')!.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendExtRequest).toHaveBeenCalledWith(expect.objectContaining({
            type: 'readerSession:send',
            payload: { sessionId: 'session-1', text: 'hello from detached' },
        }), { timeoutMs: 12000 });
    });
});
