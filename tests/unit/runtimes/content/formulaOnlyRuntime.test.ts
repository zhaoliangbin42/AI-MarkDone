import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const controllerEnable = vi.fn();
    const controllerDisable = vi.fn();
    const controllerSetFormulaSettings = vi.fn();
    const controllerCtor = vi.fn(function () {
        return {
            enable: controllerEnable,
            disable: controllerDisable,
            setFormulaSettings: controllerSetFormulaSettings,
        };
    });

    const settingsInit = vi.fn();
    let settingsCached: any = null;
    let settingsSubscriber: ((snap: any) => void) | null = null;
    const settingsCtor = vi.fn(function () {
        return {
            init: settingsInit,
            getCached: () => settingsCached,
            subscribe: (fn: (snap: any) => void) => {
                settingsSubscriber = fn;
            },
        };
    });
    let runtimeMessageListener: ((msg: unknown, sender: unknown, sendResponse?: (response: unknown) => void) => void | boolean) | null = null;
    const runtimeAddListener = vi.fn((fn: typeof runtimeMessageListener) => {
        runtimeMessageListener = fn;
    });
    const bookmarksPanelToggle = vi.fn(async () => undefined);
    const bookmarksPanelHide = vi.fn();

    return {
        controllerEnable,
        controllerDisable,
        controllerSetFormulaSettings,
        controllerCtor,
        settingsInit,
        settingsCtor,
        runtimeAddListener,
        bookmarksPanelToggle,
        bookmarksPanelHide,
        get settingsCached() {
            return settingsCached;
        },
        set settingsCached(value: any) {
            settingsCached = value;
        },
        get settingsSubscriber() {
            return settingsSubscriber;
        },
        set settingsSubscriber(value: ((snap: any) => void) | null) {
            settingsSubscriber = value;
        },
        get runtimeMessageListener() {
            return runtimeMessageListener;
        },
        set runtimeMessageListener(value: typeof runtimeMessageListener) {
            runtimeMessageListener = value;
        },
    };
});

vi.mock('@/ui/content/controllers/FormulaAssetHoverController', () => ({
    FormulaAssetHoverController: mocks.controllerCtor,
}));

vi.mock('@/drivers/content/settings/settingsClient', () => ({
    SettingsClient: mocks.settingsCtor,
}));

vi.mock('@/drivers/shared/browser', () => ({
    browser: {
        runtime: {
            onMessage: {
                addListener: mocks.runtimeAddListener,
            },
        },
    },
}));

vi.mock('@/ui/content/reader/ReaderPanel', () => ({
    ReaderPanel: vi.fn(function () {
        return {};
    }),
}));

vi.mock('@/ui/content/bookmarks/BookmarksPanelController', () => ({
    BookmarksPanelController: vi.fn(function () {
        return {
            getTheme: () => 'light',
            getThemeOverrides: () => ({}),
        };
    }),
}));

vi.mock('@/ui/content/bookmarks/BookmarksPanel', () => ({
    BookmarksPanel: vi.fn(function () {
        return {
            toggle: mocks.bookmarksPanelToggle,
            hide: mocks.bookmarksPanelHide,
        };
    }),
}));

vi.mock('@/runtimes/content/lazyContentFeatures', () => ({
    createLazyReaderPanel: vi.fn(() => ({})),
    createLazyBookmarksPanel: vi.fn(() => ({
        toggle: mocks.bookmarksPanelToggle,
        hide: mocks.bookmarksPanelHide,
    })),
}));

import {
    FormulaOnlyRuntime,
    getFormulaOnlyPlatformProfile,
    startFormulaOnlyRuntime,
    type FormulaPlatformProfile,
} from '@/runtimes/content/formulaOnlyRuntime';
import {
    formatReaderMarkdownForCopy,
    setReaderMarkdownCopyFormulaFormat,
} from '@/services/reader/readerMarkdownCopy';

function enabledFormulaSettings() {
    return {
        clickCopyMarkdown: true,
        clickCopyFormulaFormat: 'markdown-dollar',
        markdownCopyFormulaFormat: 'markdown-dollar',
        assetFontSizePx: 36,
        assetActions: {
            copyPng: true,
            copySvg: false,
            copyMathml: true,
            savePng: false,
            saveSvg: true,
        },
    };
}

function disabledFormulaSettings() {
    return {
        clickCopyMarkdown: false,
        clickCopyFormulaFormat: 'markdown-dollar',
        markdownCopyFormulaFormat: 'markdown-dollar',
        assetFontSizePx: 36,
        assetActions: {
            copyPng: false,
            copySvg: false,
            copyMathml: false,
            savePng: false,
            saveSvg: false,
        },
    };
}

afterEach(() => {
    vi.clearAllMocks();
    mocks.settingsCached = null;
    mocks.settingsSubscriber = null;
    mocks.runtimeMessageListener = null;
    setReaderMarkdownCopyFormulaFormat('markdown-dollar');
    document.body.innerHTML = '';
});

describe('formula-only content runtime', () => {
    it('detects only Gemini, Claude, and DeepSeek formula-only hosts', () => {
        expect(getFormulaOnlyPlatformProfile('https://gemini.google.com/app')?.id).toBe('gemini');
        expect(getFormulaOnlyPlatformProfile('https://claude.ai/chat/mock')?.id).toBe('claude');
        expect(getFormulaOnlyPlatformProfile('https://chat.deepseek.com/a/chat/s/mock')?.id).toBe('deepseek');
        expect(getFormulaOnlyPlatformProfile('https://chatgpt.com/c/mock')).toBeNull();
        expect(getFormulaOnlyPlatformProfile('https://example.com/')).toBeNull();
    });

    it('binds each formula-only platform to its restored formula parser adapter', () => {
        const gemini = getFormulaOnlyPlatformProfile('https://gemini.google.com/app')!;
        const claude = getFormulaOnlyPlatformProfile('https://claude.ai/chat/mock')!;
        const deepseek = getFormulaOnlyPlatformProfile('https://chat.deepseek.com/a/chat/s/mock')!;

        expect(gemini.parserAdapter.name).toBe('Gemini');
        expect(gemini.parserAdapter.isMathNode(document.createElement('span'))).toBe(false);

        const geminiMath = document.createElement('span');
        geminiMath.className = 'math-inline';
        geminiMath.setAttribute('data-math', 'x_1+y');
        expect(gemini.parserAdapter.isMathNode(geminiMath)).toBe(true);
        expect(gemini.parserAdapter.extractLatex(geminiMath)).toEqual({ latex: 'x_1+y', isBlock: false });

        expect(claude.parserAdapter.name).toBe('Claude');
        expect(deepseek.parserAdapter.name).toBe('Deepseek');
    });

    it('enables existing formula containers through the shared FormulaAssetHoverController', () => {
        mocks.settingsCached = { formula: enabledFormulaSettings() };
        document.body.innerHTML = `
            <model-response>
              <div class="model-response-text">
                <span class="math-inline" data-math="x_1+y"></span>
              </div>
            </model-response>
        `;
        const profile = getFormulaOnlyPlatformProfile('https://gemini.google.com/app')!;

        startFormulaOnlyRuntime(profile);

        expect(mocks.settingsInit).toHaveBeenCalledTimes(1);
        expect(mocks.controllerSetFormulaSettings).toHaveBeenCalledWith(enabledFormulaSettings());
        expect(mocks.controllerEnable).toHaveBeenCalledTimes(1);
        expect(mocks.controllerEnable.mock.calls[0]?.[0]).toBe(document.querySelector('model-response'));
    });

    it('opens the global bookmarks panel from the extension action message', async () => {
        mocks.settingsCached = { formula: enabledFormulaSettings() };
        const runtime = startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://chat.deepseek.com/a/chat/s/mock')!);

        expect(mocks.runtimeAddListener).toHaveBeenCalledTimes(1);
        mocks.runtimeMessageListener?.(
            { v: 1, id: 'toggle_1', type: 'ui:toggle_toolbar' },
            {},
        );
        await Promise.resolve();

        expect(mocks.bookmarksPanelToggle).toHaveBeenCalledTimes(1);
        runtime.dispose();
    });

    it('syncs the Markdown copy formula format for shared bookmark Markdown copies', () => {
        mocks.settingsCached = {
            formula: {
                ...enabledFormulaSettings(),
                markdownCopyFormulaFormat: 'latex-brackets',
            },
        };

        const runtime = startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://gemini.google.com/app')!);

        expect(formatReaderMarkdownForCopy('Inline $x+y$')).toBe('Inline \\(x+y\\)');
        runtime.dispose();
    });

    it('does not enable formula containers when every formula action is disabled', () => {
        mocks.settingsCached = { formula: disabledFormulaSettings() };
        document.body.innerHTML = `
            <div class="font-claude-response">
              <span class="katex"><annotation encoding="application/x-tex">x_1+y</annotation></span>
            </div>
        `;
        const profile = getFormulaOnlyPlatformProfile('https://claude.ai/chat/mock')!;

        startFormulaOnlyRuntime(profile);

        expect(mocks.controllerSetFormulaSettings).toHaveBeenCalledWith(disabledFormulaSettings());
        expect(mocks.controllerDisable).toHaveBeenCalledTimes(1);
        expect(mocks.controllerEnable).not.toHaveBeenCalled();
    });

    it('does not enable formula containers when the formula-only platform toggle is disabled', () => {
        mocks.settingsCached = {
            platforms: { chatgpt: true, gemini: false, claude: true, deepseek: true },
            formula: enabledFormulaSettings(),
        };
        document.body.innerHTML = `
            <model-response>
              <div class="model-response-text">
                <span class="math-inline" data-math="x_1+y"></span>
              </div>
            </model-response>
        `;

        startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://gemini.google.com/app')!);

        expect(mocks.controllerSetFormulaSettings).toHaveBeenCalledWith(enabledFormulaSettings());
        expect(mocks.controllerDisable).toHaveBeenCalledTimes(1);
        expect(mocks.controllerEnable).not.toHaveBeenCalled();
    });

    it('observes newly added formula content while enabled', async () => {
        mocks.settingsCached = { formula: enabledFormulaSettings() };
        const profile: FormulaPlatformProfile = {
            id: 'deepseek',
            hostnames: ['chat.deepseek.com'],
            observerRootSelectors: ['main'],
            contentRootSelectors: ['.ds-markdown'],
            formulaSelectors: ['.katex'],
            parserAdapter: getFormulaOnlyPlatformProfile('https://chat.deepseek.com/a/chat/s/mock')!.parserAdapter,
        };
        const runtime = new FormulaOnlyRuntime(profile);
        runtime.start();

        const message = document.createElement('div');
        message.className = 'ds-markdown';
        message.innerHTML = '<span class="katex"><annotation encoding="application/x-tex">a^2</annotation></span>';
        document.body.appendChild(message);
        await Promise.resolve();

        expect(mocks.controllerEnable).toHaveBeenCalledWith(message);
        runtime.dispose();
    });

    it('enables direct formula elements when a platform content root selector does not match', () => {
        mocks.settingsCached = { formula: enabledFormulaSettings() };
        document.body.innerHTML = `
            <main>
              <article>
                <mjx-container data-latex="\\\\sum_i x_i"></mjx-container>
              </article>
            </main>
        `;

        startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://gemini.google.com/app')!);

        expect(mocks.controllerEnable).toHaveBeenCalledWith(document.querySelector('mjx-container'));
    });

    it('keeps DeepSeek think-content formulas outside the formula-only roots', () => {
        mocks.settingsCached = { formula: enabledFormulaSettings() };
        document.body.innerHTML = `
            <main>
              <div class="ds-message">
                <div class="ds-think-content">
                  <div class="ds-markdown">
                    <span class="katex"><annotation encoding="application/x-tex">hidden</annotation></span>
                  </div>
                </div>
                <div class="ds-markdown">
                  <span class="katex"><annotation encoding="application/x-tex">visible</annotation></span>
                </div>
              </div>
            </main>
        `;

        startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://chat.deepseek.com/a/chat/s/mock')!);

        expect(mocks.controllerEnable).toHaveBeenCalledTimes(1);
        expect(mocks.controllerEnable).toHaveBeenCalledWith(document.querySelector('.ds-message > .ds-markdown'));
        expect(mocks.controllerEnable).not.toHaveBeenCalledWith(document.querySelector('.ds-message'));
    });

    it('does not observe newly added DeepSeek think-content formulas', async () => {
        mocks.settingsCached = { formula: enabledFormulaSettings() };
        document.body.innerHTML = '<main></main>';
        const runtime = startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://chat.deepseek.com/a/chat/s/mock')!);

        const message = document.createElement('div');
        message.className = 'ds-message';
        message.innerHTML = `
            <div class="ds-think-content">
              <div class="ds-markdown">
                <span class="katex"><annotation encoding="application/x-tex">hidden</annotation></span>
              </div>
            </div>
        `;
        document.querySelector('main')!.appendChild(message);
        await Promise.resolve();

        expect(mocks.controllerEnable).not.toHaveBeenCalled();
        runtime.dispose();
    });

    it('reacts to formula settings changes without constructing other platform surfaces', () => {
        mocks.settingsCached = { formula: disabledFormulaSettings() };
        document.body.innerHTML = `
            <div class="font-claude-response">
              <span class="katex"><annotation encoding="application/x-tex">x_1+y</annotation></span>
            </div>
        `;
        const runtime = startFormulaOnlyRuntime(getFormulaOnlyPlatformProfile('https://claude.ai/chat/mock')!);

        expect(mocks.controllerEnable).not.toHaveBeenCalled();
        expect(mocks.settingsSubscriber).toBeTypeOf('function');

        mocks.settingsSubscriber!({ settings: { formula: enabledFormulaSettings() } });

        expect(mocks.controllerSetFormulaSettings).toHaveBeenLastCalledWith(enabledFormulaSettings());
        expect(mocks.controllerEnable).toHaveBeenCalledWith(document.querySelector('.font-claude-response'));
        expect(mocks.controllerCtor).toHaveBeenCalledWith(expect.objectContaining({
            parserAdapter: expect.objectContaining({ name: 'Claude' }),
        }));

        mocks.settingsSubscriber!({
            settings: {
                platforms: { chatgpt: true, gemini: true, claude: false, deepseek: true },
                formula: enabledFormulaSettings(),
            },
        });

        expect(mocks.controllerDisable).toHaveBeenCalled();
        runtime.dispose();
    });
});
