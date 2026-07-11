import { DEFAULT_SETTINGS } from '../../core/settings/types';
import type { Theme } from '../../core/types/theme';
import { PROTOCOL_VERSION, isExtRequest } from '../../contracts/protocol';
import { SiteAdapter, type ThemeDetector } from '../../drivers/content/adapters/base';
import { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import type { BookmarksPanelPort } from '../../ui/content/bookmarks/BookmarksPanelPort';
import type { ReaderPanelPort } from '../../ui/content/reader/ReaderPanelPort';
import { SettingsClient } from '../../drivers/content/settings/settingsClient';
import { FormulaAssetHoverController } from '../../ui/content/controllers/FormulaAssetHoverController';
import { browser } from '../../drivers/shared/browser';
import { resolveFormulaSettings, shouldEnableFormulaInteractions } from './formulaRuntimeSettings';
import { getFormulaPlatformParserAdapter } from './formulaPlatformParsers';
import type { MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import { setReaderMarkdownCopyFormulaFormat } from '../../services/reader/readerMarkdownCopy';
import { createLazyBookmarksPanel, createLazyReaderPanel } from './lazyContentFeatures';

export type FormulaOnlyPlatformId = 'gemini' | 'claude' | 'deepseek';

export type FormulaPlatformProfile = {
    id: FormulaOnlyPlatformId;
    hostnames: readonly string[];
    observerRootSelectors: readonly string[];
    contentRootSelectors: readonly string[];
    formulaSelectors: readonly string[];
    parserAdapter: MarkdownParserAdapter;
};

const COMMON_FORMULA_SELECTORS = [
    '.math-inline',
    '.math-block',
    '.katex-display',
    '.katex',
    '.katex-error',
    'mjx-container',
    '.MathJax',
    '[data-latex-source]',
    '[data-latex]',
    '[data-tex]',
    '[data-math]',
    '[data-original-tex]',
] as const;

const FORMULA_ONLY_PROFILES: readonly FormulaPlatformProfile[] = [
    {
        id: 'gemini',
        hostnames: ['gemini.google.com'],
        observerRootSelectors: [
            'main',
            '[data-test-id="chat-history-container"]',
            '.chat-history',
        ],
        contentRootSelectors: [
            'model-response',
            '.model-response-text',
            '#extended-response-markdown-content',
            '.markdown',
        ],
        formulaSelectors: COMMON_FORMULA_SELECTORS,
        parserAdapter: getFormulaPlatformParserAdapter('gemini'),
    },
    {
        id: 'claude',
        hostnames: ['claude.ai'],
        observerRootSelectors: [
            'main',
            '[data-testid="chat-messages"]',
            '[data-testid="conversation-turns"]',
        ],
        contentRootSelectors: [
            '.font-claude-response',
            '[data-testid="assistant-message"]',
            'div.group[style*="height: auto"]',
        ],
        formulaSelectors: COMMON_FORMULA_SELECTORS,
        parserAdapter: getFormulaPlatformParserAdapter('claude'),
    },
    {
        id: 'deepseek',
        hostnames: ['chat.deepseek.com'],
        observerRootSelectors: [
            'main',
            '.ds-scroll-area',
        ],
        contentRootSelectors: [
            '.ds-markdown:not(.ds-think-content .ds-markdown)',
        ],
        formulaSelectors: COMMON_FORMULA_SELECTORS,
        parserAdapter: getFormulaPlatformParserAdapter('deepseek'),
    },
];

const formulaOnlyThemeDetector: ThemeDetector = {
    detect(): Theme | null {
        const html = document.documentElement;
        const body = document.body;
        const explicit =
            html.getAttribute('data-theme') ||
            html.getAttribute('data-mode') ||
            body?.getAttribute('data-theme') ||
            '';
        if (explicit === 'dark' || explicit === 'light') return explicit;
        if (html.classList.contains('dark') || body?.classList.contains('dark')) return 'dark';
        if (html.classList.contains('light') || body?.classList.contains('light')) return 'light';
        return null;
    },
    getObserveTargets() {
        return [
            { element: 'html', attributes: ['class', 'data-theme', 'data-mode', 'style'] },
            { element: 'body', attributes: ['class', 'data-theme', 'style'] },
        ];
    },
    hasExplicitTheme(): boolean {
        return this.detect() !== null;
    },
};

class FormulaOnlyPanelAdapter extends SiteAdapter {
    constructor(private readonly profile: FormulaPlatformProfile) {
        super();
    }

    matches(url: string): boolean {
        return getFormulaOnlyPlatformProfile(url)?.id === this.profile.id;
    }

    getPlatformId(): string {
        return this.profile.id;
    }

    getThemeDetector(): ThemeDetector {
        return formulaOnlyThemeDetector;
    }

    extractUserPrompt(): string | null {
        return null;
    }

    getMessageSelector(): string {
        return this.profile.contentRootSelectors.join(',');
    }

    getMessageContentSelector(): string {
        return this.profile.contentRootSelectors.join(',');
    }

    getActionBarSelector(): string {
        return '';
    }

    getToolbarAnchorElement(): HTMLElement | null {
        return null;
    }

    injectToolbar(): boolean {
        return false;
    }

    isStreamingMessage(): boolean {
        return false;
    }

    getMessageId(): string | null {
        return null;
    }

    getObserverContainer(): HTMLElement | null {
        for (const selector of this.profile.observerRootSelectors) {
            const element = document.querySelector(selector);
            if (element instanceof HTMLElement) return element;
        }
        return document.body || document.documentElement;
    }

    getMarkdownParserAdapter(): MarkdownParserAdapter {
        return this.profile.parserAdapter;
    }
}

export function getFormulaOnlyPlatformProfile(url: string = window.location.href): FormulaPlatformProfile | null {
    let hostname = '';
    try {
        hostname = new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }

    return FORMULA_ONLY_PROFILES.find((profile) =>
        profile.hostnames.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    ) ?? null;
}

export class FormulaOnlyRuntime {
    private readonly settingsClient = new SettingsClient();
    private readonly formulaController: FormulaAssetHoverController;
    private readonly panelAdapter: FormulaOnlyPanelAdapter;
    private readonly readerPanel: ReaderPanelPort;
    private readonly bookmarksController: BookmarksPanelController;
    private readonly bookmarksPanel: BookmarksPanelPort;
    private readonly observer: MutationObserver;
    private enabled = false;
    private started = false;

    constructor(private readonly profile: FormulaPlatformProfile) {
        this.panelAdapter = new FormulaOnlyPanelAdapter(profile);
        this.readerPanel = createLazyReaderPanel();
        this.bookmarksController = new BookmarksPanelController(this.panelAdapter);
        this.bookmarksPanel = createLazyBookmarksPanel(this.bookmarksController, this.readerPanel);
        this.formulaController = new FormulaAssetHoverController({
            parserAdapter: profile.parserAdapter,
        });
        this.observer = new MutationObserver((mutations) => {
            if (!this.enabled) return;
            for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof HTMLElement) this.enableFormulaRoots(node);
                    else if (node instanceof DocumentFragment) this.enableFormulaRoots(node);
                }
            }
        });
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        this.installRuntimeMessageBridge();
        this.settingsClient.init();
        this.applySettings(this.settingsClient.getCached());
        this.settingsClient.subscribe((snap) => {
            this.applySettings(snap.settings);
        });
    }

    dispose(): void {
        this.observer.disconnect();
        this.formulaController.disable();
        this.bookmarksPanel.hide();
        this.enabled = false;
        this.started = false;
    }

    private installRuntimeMessageBridge(): void {
        browser.runtime.onMessage.addListener((msg: unknown, _sender: unknown, sendResponse?: (response: unknown) => void) => {
            if (!isExtRequest(msg)) return;
            if (msg.type === 'ping') {
                sendResponse?.({ v: PROTOCOL_VERSION, id: msg.id, ok: true, type: msg.type, data: { pong: true } });
                return true;
            }
            if (msg.type === 'ui:toggle_toolbar') {
                void this.bookmarksPanel.toggle();
            }
        });
    }

    private applySettings(settings: typeof DEFAULT_SETTINGS | null | undefined): void {
        const platformEnabled = Boolean(settings?.platforms?.[this.profile.id] ?? DEFAULT_SETTINGS.platforms[this.profile.id]);
        const next = resolveFormulaSettings(settings?.formula);
        this.formulaController.setFormulaSettings(next);
        setReaderMarkdownCopyFormulaFormat(next.markdownCopyFormulaFormat);
        if (!platformEnabled || !shouldEnableFormulaInteractions(next)) {
            this.observer.disconnect();
            this.formulaController.disable();
            this.enabled = false;
            return;
        }

        this.enabled = true;
        this.enableCurrentFormulaRoots();
        this.observeDocument();
    }

    private enableCurrentFormulaRoots(): void {
        const roots = this.findContentRoots(document);
        if (roots.length > 0) {
            for (const root of roots) {
                this.enableFormulaRoots(root);
            }
            return;
        }

        this.findFormulaElements(document).forEach((element) => this.formulaController.enable(element));
    }

    private observeDocument(): void {
        this.observer.disconnect();
        for (const root of this.findObserverRoots()) {
            this.observer.observe(root, { childList: true, subtree: true });
        }
    }

    private enableFormulaRoots(scope: ParentNode): void {
        const roots = this.findContentRoots(scope);
        if (roots.length > 0) {
            roots.forEach((root) => this.enableFormulaContainer(root));
            return;
        }

        if (scope instanceof HTMLElement && this.matchesFormula(scope)) {
            this.formulaController.enable(scope);
        }
        if (scope instanceof DocumentFragment) {
            this.findFormulaElements(scope).forEach((element) => this.formulaController.enable(element));
        }
    }

    private enableFormulaContainer(root: HTMLElement): void {
        if (this.findFormulaElements(root).length > 0 || this.matchesFormula(root)) {
            this.formulaController.enable(root);
        }
    }

    private findContentRoots(scope: ParentNode): HTMLElement[] {
        const roots: HTMLElement[] = [];
        const add = (element: Element | null) => {
            if (element instanceof HTMLElement && !roots.includes(element)) roots.push(element);
        };

        if (scope instanceof Element) {
            for (const selector of this.profile.contentRootSelectors) {
                if (scope.matches(selector)) add(scope);
            }
        }

        for (const selector of this.profile.contentRootSelectors) {
            scope.querySelectorAll(selector).forEach(add);
        }

        return roots.filter((root) =>
            !roots.some((candidate) => candidate !== root && candidate.contains(root))
        );
    }

    private findObserverRoots(): HTMLElement[] {
        const roots: HTMLElement[] = [];
        const add = (element: Element | null) => {
            if (element instanceof HTMLElement && !roots.includes(element)) roots.push(element);
        };

        for (const selector of this.profile.observerRootSelectors) {
            document.querySelectorAll(selector).forEach(add);
        }

        if (roots.length === 0) {
            this.findContentRoots(document).forEach((root) => add(root.parentElement ?? root));
        }

        if (roots.length === 0) add(document.body || document.documentElement);

        return roots.filter((root) =>
            !roots.some((candidate) => candidate !== root && candidate.contains(root))
        );
    }

    private findFormulaElements(scope: ParentNode): HTMLElement[] {
        const elements: HTMLElement[] = [];
        const add = (element: Element | null) => {
            if (element instanceof HTMLElement && !elements.includes(element)) elements.push(element);
        };

        if (scope instanceof Element && this.matchesFormula(scope)) add(scope);
        for (const selector of this.profile.formulaSelectors) {
            scope.querySelectorAll(selector).forEach(add);
        }

        return elements;
    }

    private matchesFormula(element: Element): boolean {
        return this.profile.formulaSelectors.some((selector) => element.matches(selector));
    }
}

export function startFormulaOnlyRuntime(profile: FormulaPlatformProfile): FormulaOnlyRuntime {
    const runtime = new FormulaOnlyRuntime(profile);
    runtime.start();
    return runtime;
}
