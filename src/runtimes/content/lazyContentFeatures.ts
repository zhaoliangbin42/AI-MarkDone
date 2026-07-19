import type { Theme } from '../../core/types/theme';
import { extensionAssets } from '../../../config/extension/assets';
import { browser } from '../../drivers/shared/browser';
import type { ReaderItem } from '../../services/reader/types';
import type { BookmarksPanelController } from '../../ui/content/bookmarks/BookmarksPanelController';
import type { BookmarksPanelOptions, BookmarksPanelPort } from '../../ui/content/bookmarks/BookmarksPanelPort';
import type {
    ReaderCommentExportContext,
    ReaderPanelPromptManagerController,
    ReaderPanelReplaceItemsOptions,
    ReaderPanelSettingsController,
    ReaderPanelShowOptions,
} from '../../ui/content/reader/ReaderPanel';
import type { ReaderPanelPort } from '../../ui/content/reader/ReaderPanelPort';
import type { AppSettings } from '../../core/settings/types';
import type { BookmarkSaveDialogPort, SaveMessagesDialogPort } from '../../ui/content/ContentDialogPorts';
import type { FormulaSourceFormat } from '../../core/math/formulaSourceFormat';
import type { ExportSettings } from '../../core/settings/export';
import type { copyMessagePng } from '../../services/copy/copy-turn-png';
import type { runFormulaAssetAction } from '../../services/math/formulaAssetActions';
import type { renderFormulaSvgAsset } from '../../services/math/formulaAssetRenderer';
import type { UiLocale } from '../../ui/content/components/i18n';
import type * as ContentFeatureModuleExports from './contentFeatures';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../style/appearance';

type ContentFeatureModule = typeof ContentFeatureModuleExports;
type ContentFeatureImporter = () => Promise<ContentFeatureModule>;

async function importContentFeatureModule(): Promise<ContentFeatureModule> {
    const moduleUrl = browser.runtime.getURL(extensionAssets.contentFeaturesEntry);
    return import(/* @vite-ignore */ moduleUrl) as Promise<ContentFeatureModule>;
}

export class ContentFeatureModuleLoader {
    private modulePromise: Promise<ContentFeatureModule> | null = null;
    private loadedModule: ContentFeatureModule | null = null;
    private desiredLocale: UiLocale = 'auto';
    private localeRevision = 0;
    private synchronizedLocaleRevision = -1;
    private localeSyncPromise: Promise<void> = Promise.resolve();

    constructor(private readonly importer: ContentFeatureImporter = importContentFeatureModule) {}

    load(): Promise<ContentFeatureModule> {
        if (!this.modulePromise) {
            this.modulePromise = this.importer()
                .then(async (module) => {
                    this.loadedModule = module;
                    return module;
                })
                .catch((error) => {
                    this.loadedModule = null;
                    this.modulePromise = null;
                    throw error;
                });
        }
        return this.modulePromise.then(async (module) => {
            await this.queueLocaleSynchronization(module);
            return module;
        });
    }

    setLocale(locale: UiLocale): void {
        if (locale === this.desiredLocale && this.localeRevision > 0) return;
        this.desiredLocale = locale;
        this.localeRevision += 1;
        if (this.loadedModule) {
            void this.queueLocaleSynchronization(this.loadedModule);
        }
    }

    private queueLocaleSynchronization(module: ContentFeatureModule): Promise<void> {
        const synchronize = () => this.synchronizeLocale(module);
        this.localeSyncPromise = this.localeSyncPromise.then(synchronize, synchronize);
        return this.localeSyncPromise;
    }

    private async synchronizeLocale(module: ContentFeatureModule): Promise<void> {
        while (true) {
            const revision = this.localeRevision;
            if (revision === this.synchronizedLocaleRevision) return;
            const locale = this.desiredLocale;
            await module.setContentFeatureLocale(locale);
            this.synchronizedLocaleRevision = revision;
            if (revision === this.localeRevision) return;
        }
    }
}

const defaultLoader = new ContentFeatureModuleLoader();

export function setLazyContentFeatureLocale(locale: UiLocale): void {
    defaultLoader.setLocale(locale);
}

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
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private readerSettings: AppSettings['reader'] | null = null;
    private settingsController: ReaderPanelSettingsController | null = null;
    private promptManagerController: ReaderPanelPromptManagerController | null = null;

    constructor(loader: ContentFeatureModuleLoader) {
        this.lazy = new LazyInstance(
            () => loader.load().then((module) => module.createReaderPanel()),
            (instance) => {
                instance.setAppearance(this.appearance);
                if (this.readerSettings) instance.setReaderSettings(this.readerSettings);
                instance.setReaderSettingsController(this.settingsController);
                instance.setPromptManagerController(this.promptManagerController);
            },
        );
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.lazy.current?.setAppearance(snapshot);
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
        this.setAppearance(createAppearanceSnapshot(theme, this.appearance.overrides));
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

    async replaceItems(items: ReaderItem[], options?: ReaderPanelReplaceItemsOptions): Promise<void> {
        if (!this.lazy.current) return;
        await this.lazy.current.replaceItems(items, options);
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
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private exportSettings: ExportSettings | null = null;
    private markdownFormulaFormat: FormulaSourceFormat | null = null;

    constructor(loader: ContentFeatureModuleLoader) {
        this.lazy = new LazyInstance(
            () => loader.load().then((module) => module.getSaveMessagesDialog()),
            (instance) => {
                instance.setAppearance(this.appearance);
                if (this.exportSettings) instance.setExportSettings(this.exportSettings);
                if (this.markdownFormulaFormat) instance.setMarkdownFormulaFormat(this.markdownFormulaFormat);
            },
        );
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.lazy.current?.setAppearance(snapshot);
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
        this.setAppearance(createAppearanceSnapshot(args[1], this.appearance.overrides));
        const instance = await this.lazy.resolve();
        await instance.open(...args);
    }
}

class LazyBookmarkSaveDialog implements BookmarkSaveDialogPort {
    private readonly lazy: LazyInstance<BookmarkSaveDialogPort>;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');

    constructor(loader: ContentFeatureModuleLoader) {
        this.lazy = new LazyInstance(
            () => loader.load().then((module) => module.getBookmarkSaveDialog()),
            (instance) => {
                instance.setAppearance(this.appearance);
            },
        );
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.lazy.current?.setAppearance(snapshot);
    }

    async open(...args: Parameters<BookmarkSaveDialogPort['open']>) {
        this.setAppearance(createAppearanceSnapshot(args[0].theme, this.appearance.overrides));
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

export function createLazyCopyMessagePng(
    loader: ContentFeatureModuleLoader = defaultLoader,
): typeof copyMessagePng {
    return async (...args) => {
        const module = await loader.load();
        return module.copyMessagePng(...args);
    };
}

export function createLazyRunFormulaAssetAction(
    loader: ContentFeatureModuleLoader = defaultLoader,
): typeof runFormulaAssetAction {
    return async (...args) => {
        const module = await loader.load();
        return module.runFormulaAssetAction(...args);
    };
}

export function createLazyRenderFormulaSvgAsset(
    loader: ContentFeatureModuleLoader = defaultLoader,
): typeof renderFormulaSvgAsset {
    return async (...args) => {
        const module = await loader.load();
        return module.renderFormulaSvgAsset(...args);
    };
}
