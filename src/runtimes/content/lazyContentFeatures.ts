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
import type { ContentFeatureModule } from './contentFeatureContract';
import type { BookmarkSaveDialogPort, SaveMessagesDialogPort } from '../../ui/content/ContentDialogPorts';
import type { FormulaSourceFormat } from '../../core/math/formulaSourceFormat';
import type { ExportSettings } from '../../core/settings/export';
import type { copyTurnsPng } from '../../services/copy/copy-turn-png';

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

class LazyReaderPanel implements ReaderPanelPort {
    private instance: ReaderPanelPort | null = null;
    private instancePromise: Promise<ReaderPanelPort> | null = null;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private readerSettings: AppSettings['reader'] | null = null;
    private settingsController: ReaderPanelSettingsController | null = null;
    private promptManagerController: ReaderPanelPromptManagerController | null = null;

    constructor(private readonly loader: ContentFeatureModuleLoader) {}

    private resolve(): Promise<ReaderPanelPort> {
        if (this.instance) return Promise.resolve(this.instance);
        if (!this.instancePromise) {
            this.instancePromise = this.loader.load()
                .then(async (module) => {
                    const instance = await module.createReaderPanel();
                    instance.setTheme(this.theme);
                    instance.setThemeOverrides(this.themeOverrides);
                    if (this.readerSettings) instance.setReaderSettings(this.readerSettings);
                    instance.setReaderSettingsController(this.settingsController);
                    instance.setPromptManagerController(this.promptManagerController);
                    this.instance = instance;
                    return instance;
                })
                .catch((error) => {
                    this.instancePromise = null;
                    throw error;
                });
        }
        return this.instancePromise;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.instance?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.instance?.setThemeOverrides(this.themeOverrides);
    }

    setReaderSettings(settings: AppSettings['reader']): void {
        this.readerSettings = structuredClone(settings);
        this.instance?.setReaderSettings(this.readerSettings);
    }

    setReaderSettingsController(controller: ReaderPanelSettingsController | null): void {
        this.settingsController = controller;
        this.instance?.setReaderSettingsController(controller);
    }

    setPromptManagerController(controller: ReaderPanelPromptManagerController | null): void {
        this.promptManagerController = controller;
        this.instance?.setPromptManagerController(controller);
    }

    async show(
        items: ReaderItem[],
        startIndex: number,
        theme: Theme,
        options?: ReaderPanelShowOptions,
    ): Promise<void> {
        this.theme = theme;
        const instance = await this.resolve();
        await instance.show(items, startIndex, theme, options);
    }

    hide(): void {
        this.instance?.hide();
    }

    isShowingConversationReader(): boolean {
        return this.instance?.isShowingConversationReader() ?? false;
    }

    getItemsSnapshot(): ReaderItem[] {
        return this.instance?.getItemsSnapshot() ?? [];
    }

    async appendItem(item: ReaderItem): Promise<void> {
        if (!this.instance) return;
        await this.instance.appendItem(item);
    }

    getCommentExportContext(): ReaderCommentExportContext | null {
        return this.instance?.getCommentExportContext() ?? null;
    }
}

class LazyBookmarksPanel implements BookmarksPanelPort {
    private instance: BookmarksPanelPort | null = null;
    private instancePromise: Promise<BookmarksPanelPort> | null = null;

    constructor(
        private readonly controller: BookmarksPanelController,
        private readonly readerPanel: ReaderPanelPort,
        private readonly options: BookmarksPanelOptions,
        private readonly loader: ContentFeatureModuleLoader,
    ) {}

    private resolve(): Promise<BookmarksPanelPort> {
        if (this.instance) return Promise.resolve(this.instance);
        if (!this.instancePromise) {
            this.instancePromise = this.loader.load()
                .then(async (module) => {
                    const instance = await module.createBookmarksPanel(this.controller, this.readerPanel, this.options);
                    this.instance = instance;
                    return instance;
                })
                .catch((error) => {
                    this.instancePromise = null;
                    throw error;
                });
        }
        return this.instancePromise;
    }

    isVisible(): boolean {
        return this.instance?.isVisible() ?? false;
    }

    async toggle(): Promise<void> {
        const instance = await this.resolve();
        await instance.toggle();
    }

    async show(): Promise<void> {
        const instance = await this.resolve();
        await instance.show();
    }

    hide(): void {
        this.instance?.hide();
    }
}

class LazySaveMessagesDialog implements SaveMessagesDialogPort {
    private instance: SaveMessagesDialogPort | null = null;
    private instancePromise: Promise<SaveMessagesDialogPort> | null = null;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};
    private exportSettings: ExportSettings | null = null;
    private markdownFormulaFormat: FormulaSourceFormat | null = null;

    constructor(private readonly loader: ContentFeatureModuleLoader) {}

    private resolve(): Promise<SaveMessagesDialogPort> {
        if (this.instance) return Promise.resolve(this.instance);
        if (!this.instancePromise) {
            this.instancePromise = this.loader.load()
                .then(async (module) => {
                    const instance = await module.getSaveMessagesDialog();
                    instance.setTheme(this.theme);
                    instance.setThemeOverrides(this.themeOverrides);
                    if (this.exportSettings) instance.setExportSettings(this.exportSettings);
                    if (this.markdownFormulaFormat) instance.setMarkdownFormulaFormat(this.markdownFormulaFormat);
                    this.instance = instance;
                    return instance;
                })
                .catch((error) => {
                    this.instancePromise = null;
                    throw error;
                });
        }
        return this.instancePromise;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.instance?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.instance?.setThemeOverrides(this.themeOverrides);
    }

    setExportSettings(settings: ExportSettings): void {
        this.exportSettings = structuredClone(settings);
        this.instance?.setExportSettings(this.exportSettings);
    }

    setMarkdownFormulaFormat(format: FormulaSourceFormat): void {
        this.markdownFormulaFormat = format;
        this.instance?.setMarkdownFormulaFormat(format);
    }

    async open(...args: Parameters<SaveMessagesDialogPort['open']>): Promise<void> {
        this.theme = args[1];
        const instance = await this.resolve();
        await instance.open(...args);
    }
}

class LazyBookmarkSaveDialog implements BookmarkSaveDialogPort {
    private instance: BookmarkSaveDialogPort | null = null;
    private instancePromise: Promise<BookmarkSaveDialogPort> | null = null;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};

    constructor(private readonly loader: ContentFeatureModuleLoader) {}

    private resolve(): Promise<BookmarkSaveDialogPort> {
        if (this.instance) return Promise.resolve(this.instance);
        if (!this.instancePromise) {
            this.instancePromise = this.loader.load()
                .then(async (module) => {
                    const instance = await module.getBookmarkSaveDialog();
                    instance.setTheme(this.theme);
                    instance.setThemeOverrides(this.themeOverrides);
                    this.instance = instance;
                    return instance;
                })
                .catch((error) => {
                    this.instancePromise = null;
                    throw error;
                });
        }
        return this.instancePromise;
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.instance?.setTheme(theme);
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        this.instance?.setThemeOverrides(this.themeOverrides);
    }

    async open(...args: Parameters<BookmarkSaveDialogPort['open']>) {
        this.theme = args[0].theme;
        const instance = await this.resolve();
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
