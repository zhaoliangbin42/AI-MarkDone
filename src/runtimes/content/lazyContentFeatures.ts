import type { Theme } from '../../core/types/theme';
import { extensionAssets } from '../../../config/extension/assets';
import { browser } from '../../drivers/shared/browser';
import type { ReaderItem } from '../../services/reader/types';
import type { UserThemeOverrides } from '../../style/tokens';
import type { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import type { BookmarksPanelOptions, BookmarksPanelPort } from '../../ui/content/bookmarks/BookmarksPanelPort';
import type {
    ReaderCommentExportContext,
    ReaderPanelPromptManagerController,
    ReaderPanelSettingsController,
    ReaderPanelShowOptions,
} from '../../ui/content/reader/ReaderPanel';
import type { ReaderPanelPort } from '../../ui/content/reader/ReaderPanelPort';
import type { AppSettings } from '../../core/settings/types';
import type { BookmarkSaveDialogPort, SaveMessagesDialogPort } from '../../ui/content/ContentDialogPorts';
import type { FormulaSourceFormat } from '../../core/math/formulaSourceFormat';
import type { ExportSettings } from '../../core/settings/export';
import type { copyTurnsPng } from '../../services/copy/copy-turn-png';
import type * as ContentFeatureModuleExports from './contentFeatures';

type ContentFeatureModule = typeof ContentFeatureModuleExports;
type ContentFeatureImporter = () => Promise<ContentFeatureModule>;

async function importContentFeatureModule(): Promise<ContentFeatureModule> {
    const moduleUrl = browser.runtime.getURL(extensionAssets.contentFeaturesEntry);
    return import(/* @vite-ignore */ moduleUrl) as Promise<ContentFeatureModule>;
}

export class ContentFeatureModuleLoader {
    private modulePromise: Promise<ContentFeatureModule> | null = null;

    constructor(private readonly importer: ContentFeatureImporter = importContentFeatureModule) {}

    load(): Promise<ContentFeatureModule> {
        if (!this.modulePromise) {
            this.modulePromise = this.importer().catch((error) => {
                this.modulePromise = null;
                throw error;
            });
        }
        return this.modulePromise;
    }
}

const defaultLoader = new ContentFeatureModuleLoader();

class LazyInstance<T> {
    private instance: T | null = null;
    private pending: Promise<T> | null = null;

    constructor(
        private readonly create: () => Promise<T>,
        private readonly initialize: (instance: T) => void = () => undefined,
    ) {}

    get current(): T | null {
        return this.instance;
    }

    resolve(): Promise<T> {
        if (this.instance) return Promise.resolve(this.instance);
        if (!this.pending) {
            this.pending = this.create()
                .then((instance) => {
                    this.initialize(instance);
                    this.instance = instance;
                    return instance;
                })
                .catch((error) => {
                    this.pending = null;
                    throw error;
                });
        }
        return this.pending;
    }
}

class LazyReaderPanel implements ReaderPanelPort {
    private readonly lazy: LazyInstance<ReaderPanelPort>;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private readerSettings: AppSettings['reader'] | null = null;
    private settingsController: ReaderPanelSettingsController | null = null;
    private promptManagerController: ReaderPanelPromptManagerController | null = null;

    constructor(loader: ContentFeatureModuleLoader) {
        this.lazy = new LazyInstance(
            () => loader.load().then((module) => module.createReaderPanel()),
            (instance) => {
                instance.setTheme(this.theme);
                instance.setThemeOverrides(this.themeOverrides);
                if (this.readerSettings) instance.setReaderSettings(this.readerSettings);
                instance.setReaderSettingsController(this.settingsController);
                instance.setPromptManagerController(this.promptManagerController);
            },
        );
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.lazy.current?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.lazy.current?.setThemeOverrides(this.themeOverrides);
    }

    setReaderSettings(settings: AppSettings['reader']): void {
        this.readerSettings = structuredClone(settings);
        this.lazy.current?.setReaderSettings(this.readerSettings);
    }

    setReaderSettingsController(controller: ReaderPanelSettingsController | null): void {
        this.settingsController = controller;
        this.lazy.current?.setReaderSettingsController(controller);
    }

    setPromptManagerController(controller: ReaderPanelPromptManagerController | null): void {
        this.promptManagerController = controller;
        this.lazy.current?.setPromptManagerController(controller);
    }

    async show(
        items: ReaderItem[],
        startIndex: number,
        theme: Theme,
        options?: ReaderPanelShowOptions,
    ): Promise<void> {
        this.theme = theme;
        const instance = await this.lazy.resolve();
        await instance.show(items, startIndex, theme, options);
    }

    hide(): void {
        this.lazy.current?.hide();
    }

    isShowingConversationReader(): boolean {
        return this.lazy.current?.isShowingConversationReader() ?? false;
    }

    getItemsSnapshot(): ReaderItem[] {
        return this.lazy.current?.getItemsSnapshot() ?? [];
    }

    async appendItem(item: ReaderItem): Promise<void> {
        if (!this.lazy.current) return;
        await this.lazy.current.appendItem(item);
    }

    getCommentExportContext(): ReaderCommentExportContext | null {
        return this.lazy.current?.getCommentExportContext() ?? null;
    }
}

class LazyBookmarksPanel implements BookmarksPanelPort {
    private readonly lazy: LazyInstance<BookmarksPanelPort>;

    constructor(
        controller: BookmarksPanelController,
        readerPanel: ReaderPanelPort,
        options: BookmarksPanelOptions,
        loader: ContentFeatureModuleLoader,
    ) {
        this.lazy = new LazyInstance(() => loader.load().then(
            (module) => module.createBookmarksPanel(controller, readerPanel, options),
        ));
    }

    isVisible(): boolean {
        return this.lazy.current?.isVisible() ?? false;
    }

    async toggle(): Promise<void> {
        const instance = await this.lazy.resolve();
        await instance.toggle();
    }

    async show(): Promise<void> {
        const instance = await this.lazy.resolve();
        await instance.show();
    }

    hide(): void {
        this.lazy.current?.hide();
    }
}

class LazySaveMessagesDialog implements SaveMessagesDialogPort {
    private readonly lazy: LazyInstance<SaveMessagesDialogPort>;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private exportSettings: ExportSettings | null = null;
    private markdownFormulaFormat: FormulaSourceFormat | null = null;

    constructor(loader: ContentFeatureModuleLoader) {
        this.lazy = new LazyInstance(
            () => loader.load().then((module) => module.getSaveMessagesDialog()),
            (instance) => {
                instance.setTheme(this.theme);
                instance.setThemeOverrides(this.themeOverrides);
                if (this.exportSettings) instance.setExportSettings(this.exportSettings);
                if (this.markdownFormulaFormat) instance.setMarkdownFormulaFormat(this.markdownFormulaFormat);
            },
        );
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.lazy.current?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.lazy.current?.setThemeOverrides(this.themeOverrides);
    }

    setExportSettings(settings: ExportSettings): void {
        this.exportSettings = structuredClone(settings);
        this.lazy.current?.setExportSettings(this.exportSettings);
    }

    setMarkdownFormulaFormat(format: FormulaSourceFormat): void {
        this.markdownFormulaFormat = format;
        this.lazy.current?.setMarkdownFormulaFormat(format);
    }

    async open(...args: Parameters<SaveMessagesDialogPort['open']>): Promise<void> {
        this.theme = args[1];
        const instance = await this.lazy.resolve();
        await instance.open(...args);
    }
}

class LazyBookmarkSaveDialog implements BookmarkSaveDialogPort {
    private readonly lazy: LazyInstance<BookmarkSaveDialogPort>;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};

    constructor(loader: ContentFeatureModuleLoader) {
        this.lazy = new LazyInstance(
            () => loader.load().then((module) => module.getBookmarkSaveDialog()),
            (instance) => {
                instance.setTheme(this.theme);
                instance.setThemeOverrides(this.themeOverrides);
            },
        );
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.lazy.current?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.lazy.current?.setThemeOverrides(this.themeOverrides);
    }

    async open(...args: Parameters<BookmarkSaveDialogPort['open']>) {
        this.theme = args[0].theme;
        const instance = await this.lazy.resolve();
        return instance.open(...args);
    }
}

export function createLazyReaderPanel(loader: ContentFeatureModuleLoader = defaultLoader): ReaderPanelPort {
    return new LazyReaderPanel(loader);
}

export function createLazyBookmarksPanel(
    controller: BookmarksPanelController,
    readerPanel: ReaderPanelPort,
    options: BookmarksPanelOptions = {},
    loader: ContentFeatureModuleLoader = defaultLoader,
): BookmarksPanelPort {
    return new LazyBookmarksPanel(controller, readerPanel, options, loader);
}

export function createLazySaveMessagesDialog(
    loader: ContentFeatureModuleLoader = defaultLoader,
): SaveMessagesDialogPort {
    return new LazySaveMessagesDialog(loader);
}

export function createLazyBookmarkSaveDialog(
    loader: ContentFeatureModuleLoader = defaultLoader,
): BookmarkSaveDialogPort {
    return new LazyBookmarkSaveDialog(loader);
}

export function createLazyCopyTurnsPng(
    loader: ContentFeatureModuleLoader = defaultLoader,
): typeof copyTurnsPng {
    return async (...args) => {
        const module = await loader.load();
        return module.copyTurnsPng(...args);
    };
}
