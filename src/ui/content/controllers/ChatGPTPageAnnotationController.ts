import { normalizeSelectionToolbarActions, type SelectionToolbarActions } from '../../../core/settings/selectionToolbar';
import { readMarkDocumentTitle } from '../../../drivers/content/chatgpt/readMarkDocumentTitle';
import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import {
    DOMContentSurfaceAdapter,
    listMessageContentRoots,
    type ContentSurfaceAdapter,
} from '../../../drivers/content/adapters/ContentSurfaceAdapter';
import type { ContentSurfaceSelectionEvidenceV1 } from '../../../contracts/contentSurface';
import type { ConversationContentSourceV1 } from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import type { ConversationNavigationPortV1 } from '../../../contracts/conversationNavigation';
import type { ReaderAnnotationTarget } from '../../../contracts/readerAnnotations';
import { readerAnnotationDocumentKey } from '../../../contracts/readerAnnotations';
import {
    createAppearanceSnapshot,
    areAppearanceSnapshotsEqual,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import {
    createPageCommentRecord,
    resolveReaderCommentAnchor,
    resolveSelectionLayout,
    type ReaderCommentResolvedAnchor,
    type ReaderCommentRect,
} from '../../../services/reader/commentAnchoring';
import type { ReaderCommentRecord } from '../../../services/reader/commentSession';
import { PageAnnotationStore } from '../../../services/reader/pageAnnotationStore';
import {
    PageMarkdownSelectionResolver,
    isPageMarkdownSelectionSnapshotCurrent,
    type PageMarkdownSelectionSnapshot,
} from '../selectionMarkdownSnapshot';
import {
    ChatGPTPageSelectionCoordinator,
    type ChatGPTPageSelectionFrame,
} from './ChatGPTPageSelectionCoordinator';
import { copyCanonicalMarkdownToClipboard } from '../../../services/copy/canonicalMarkdownCopy';
import {
    buildCommentsExport,
    resolveReaderCommentExportPrompts,
} from '../../../services/reader/commentExport';
import {
    createDefaultReaderCommentExportSettings,
    type ReaderCommentExportSettings,
} from '../../../core/settings/readerCommentExport';
import { createReaderAnnotationDocument } from '../../../services/reader/readerContentSource';
import { readComposer, replaceComposerTextRange } from '../../../drivers/content/sending/composerPort';
import { findChatGPTComposerInputEnhancementMount } from '../../../drivers/content/chatgpt/composerInputEnhancementMount';
import { PageAnnotationOverlay } from '../pageAnnotations/PageAnnotationOverlay';
import { ComposerAnnotationChip } from '../pageAnnotations/ComposerAnnotationChip';
import { PageAnnotationMarkers, type MarkersAnchorRender } from '../pageAnnotations/PageAnnotationMarkers';
import { PageAnnotationManagerPopover } from '../pageAnnotations/PageAnnotationManagerPopover';
import { ReaderCommentPopover } from '../reader/ReaderCommentPopover';
import { OverlaySession } from '../overlay/OverlaySession';
import { showToast } from '../../../utils/toast';
import { t } from '../components/i18n';
import { getRuntimeFailurePresentation } from '../components/runtimeFailurePresentation';
import { RuntimeClientRequestError } from '../../../drivers/shared/clients/clientResult';
import { isHighlightableTextSelection } from '../../../services/reader/highlightSelection';

const ID_PREFIX = 'comment-';

type ControllerOptions = Readonly<{
    contentSource?: ConversationContentSourceV1 | null;
    materialization?: ConversationMaterializationPortV1 | null;
    surfaceAdapter?: ContentSurfaceAdapter;
    selectionCoordinator?: ChatGPTPageSelectionCoordinator;
    markdownResolver?: PageMarkdownSelectionResolver;
    navigation?: ConversationNavigationPortV1 | null;
}>;

type TurnMeta = {
    roundId: string | null;
    userMessageId: string | null;
    position: number | null;
};

type AnchorCacheEntry = {
    root: HTMLElement;
    range: Range | null;
    layout: ReaderCommentResolvedAnchor | null;
    layoutEpoch: number;
    revision?: number;
    updatedAt: number;
};

type PointerAnchor = {
    x: number;
    y: number;
    key: string;
};

export type ReaderSettingsInput = {
    selectionToolbar?: SelectionToolbarActions;
    persistAnnotations?: boolean;
    commentExport?: ReaderCommentExportSettings;
};

import { HighlightSession, createHighlightRecord, highlightAnchor } from '../highlights/HighlightSession';
import type { HighlightColor } from '../../../contracts/highlights';

export class ChatGPTPageAnnotationController {
    private initialized = false;
    private featureEnabled = false;
    private appearance: AppearanceSnapshot;
    private persistEnabled = false;
    private selectionToolbarEnabled = true;
    private selectionToolbarActions = normalizeSelectionToolbarActions(undefined);
    private annotationsEnabled = true;
    private highlightSaving = false;
    private readonly highlights = new HighlightSession(
        () => this.syncAnnotationSurface(),
        error => this.showHighlightError(error, 'highlightLoadFailed', 'Could not load highlights'),
    );
    private commentExportSettings: ReaderCommentExportSettings = createDefaultReaderCommentExportSettings();

    private readonly contentSource: ConversationContentSourceV1 | null;
    private readonly materialization: ConversationMaterializationPortV1 | null;
    private readonly surfaceAdapter: ContentSurfaceAdapter;
    private readonly selectionCoordinator: ChatGPTPageSelectionCoordinator;
    private readonly markdownResolver: PageMarkdownSelectionResolver;
    private readonly ownsSelectionCoordinator: boolean;
    private unsubscribeSelection: (() => void) | null = null;
    private readonly navigation: ConversationNavigationPortV1 | null;
    private readonly store = new PageAnnotationStore();
    private overlay: PageAnnotationOverlay | null = null;
    private readonly markers: PageAnnotationMarkers;
    private readonly composerChip: ComposerAnnotationChip;
    private readonly commentPopover = new ReaderCommentPopover();
    private readonly manager = new PageAnnotationManagerPopover();

    private managerSession: OverlaySession | null = null;
    private mode: 'closed' | 'actions' | 'editing' = 'closed';
    private lastSelection: PageMarkdownSelectionSnapshot | null = null;
    private lastFrame: ChatGPTPageSelectionFrame | null = null;
    private lastKey = '';
    private toolbarKey: string | null = null;
    private activeAnnotationId: string | null = null;
    private activeHighlightId: string | null = null;
    private pointerAnchor: PointerAnchor | null = null;
    private pointerSelectionActive = false;
    private toolbarActionActive = false;
    private actionSnapshot: PageMarkdownSelectionSnapshot | null = null;
    private turnMeta = new Map<string, TurnMeta>();
    private readonly anchorCache = new Map<string, AnchorCacheEntry>();
    private annotationRootCache = new WeakMap<HTMLElement, HTMLElement>();
    private readonly unsubscribes: Array<() => void> = [];
    private readonly pxVarCache = new Map<string, number>();
    private lastDocumentKey: string | null = null;
    private lastMaterializationToken: string | null = null;
    private markerLayoutEpoch = 0;
    private lastAnnotationsSyncKey: string | null = null;
    private resizeRafId: number | null = null;
    private sourceRafId: number | null = null;

    constructor(
        private readonly adapter: SiteAdapter,
        options: ControllerOptions = {},
    ) {
        this.contentSource = options.contentSource ?? null;
        this.materialization = options.materialization ?? null;
        this.navigation = options.navigation ?? null;
        this.surfaceAdapter = options.surfaceAdapter
            ?? new DOMContentSurfaceAdapter(adapter, this.materialization);
        this.ownsSelectionCoordinator = !options.selectionCoordinator;
        this.selectionCoordinator = options.selectionCoordinator
            ?? new ChatGPTPageSelectionCoordinator({
                surfaceAdapter: this.surfaceAdapter,
                materialization: this.materialization,
            });
        this.markdownResolver = options.markdownResolver
            ?? new PageMarkdownSelectionResolver({
                adapter,
                contentSource: this.contentSource,
                materialization: this.materialization,
                surfaceAdapter: this.surfaceAdapter,
            });
        this.appearance = createAppearanceSnapshot(
            document.documentElement.getAttribute('data-aimd-theme') === 'dark' ? 'dark' : 'light',
        );
        this.markers = new PageAnnotationMarkers(this.appearance, () => this.handleResize());
        this.composerChip = new ComposerAnnotationChip(this.appearance);
    }

    setEnabled(enabled: boolean): void {
        if (enabled === this.featureEnabled) return;
        this.featureEnabled = enabled;
        if (enabled) this.init();
        else this.dispose();
    }

    /** @deprecated The annotation entry is always enabled when annotations exist. */
    setComposerControlVisible(_visible: boolean): void { this.syncChip(); }

    setSelectionToolbarEnabled(enabled: boolean): void {
        if (enabled === this.selectionToolbarEnabled) return;
        this.selectionToolbarEnabled = enabled;
        if (!enabled) {
            if (this.mode === 'actions') this.closeToolbar();
            return;
        }
        if (this.initialized && this.mode === 'closed') {
            const frame = this.selectionCoordinator.getCurrentFrame() ?? this.selectionCoordinator.refreshNow();
            if (frame) this.showToolbar(frame, selectionKey(frame));
        }
    }

    setAnnotationsEnabled(enabled: boolean): void {
        if (this.annotationsEnabled === enabled) return;
        this.annotationsEnabled = enabled;
        if (this.initialized) {
            this.closeToolbar(); this.manager.close();
            this.lastAnnotationsSyncKey = null; this.syncAnnotationSurface();
        }
    }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureOverlay();
        if (this.ownsSelectionCoordinator) this.selectionCoordinator.init();
        this.unsubscribeSelection = this.selectionCoordinator.subscribe(this.handleSelectionFrame);
        this.unsubscribes.push(this.store.onChange(() => {
            this.syncAnnotationSurface();
            this.manager.refresh();
        }));
        document.addEventListener('pointerdown', this.handlePointerDown, true);
        document.addEventListener('pointerup', this.handlePointerUp, true);
        document.addEventListener('pointercancel', this.handlePointerCancel, true);
        document.addEventListener('keydown', this.handleKeyDown, true);
        document.addEventListener('focusin', this.handleFocusIn, true);
        document.addEventListener('scroll', this.handleMarkerScroll, true);
        window.addEventListener('resize', this.handleResize);
        if (this.contentSource) this.unsubscribes.push(this.contentSource.subscribe(this.handleSourceChanged));
        if (this.materialization) this.unsubscribes.push(this.materialization.subscribe(this.handleSourceChanged));
        void this.syncDocument();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        this.unsubscribeSelection?.();
        this.unsubscribeSelection = null;
        document.removeEventListener('pointerdown', this.handlePointerDown, true);
        document.removeEventListener('pointerup', this.handlePointerUp, true);
        document.removeEventListener('pointercancel', this.handlePointerCancel, true);
        document.removeEventListener('keydown', this.handleKeyDown, true);
        document.removeEventListener('focusin', this.handleFocusIn, true);
        document.removeEventListener('scroll', this.handleMarkerScroll, true);
        window.removeEventListener('resize', this.handleResize);
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
        this.unsubscribes.length = 0;
        if (this.resizeRafId !== null) { window.cancelAnimationFrame(this.resizeRafId); this.resizeRafId = null; }
        if (this.sourceRafId !== null) { window.cancelAnimationFrame(this.sourceRafId); this.sourceRafId = null; }
        if (this.ownsSelectionCoordinator) this.selectionCoordinator.dispose();
        this.commentPopover.destroy();
        this.manager.close();
        this.managerSession?.unmount();
        this.managerSession = null;
        this.store.dispose();
        this.highlights.dispose();
        this.markers.dispose();
        this.composerChip.dispose();
        this.overlay?.unmount();
        this.overlay = null;
        this.mode = 'closed';
        this.lastSelection = null;
        this.lastFrame = null;
        this.lastKey = '';
        this.toolbarKey = null;
        this.pointerAnchor = null;
        this.pointerSelectionActive = false;
        this.toolbarActionActive = false;
        this.actionSnapshot = null;
        this.activeAnnotationId = null;
        this.activeHighlightId = null;
        this.anchorCache.clear();
        this.annotationRootCache = new WeakMap<HTMLElement, HTMLElement>();
        this.lastAnnotationsSyncKey = null;
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        if (areAppearanceSnapshotsEqual(this.appearance, snapshot)) return;
        this.appearance = snapshot;
        this.overlay?.setAppearance(snapshot);
        this.markers.setAppearance(snapshot);
        this.composerChip.setAppearance(snapshot);
        this.commentPopover.setAppearance(snapshot);
        this.managerSession?.setAppearance(snapshot);
        this.pxVarCache.clear();
    }

    setReaderSettings(settings: ReaderSettingsInput): void {
        if (settings.selectionToolbar) {
            this.selectionToolbarActions = normalizeSelectionToolbarActions(settings.selectionToolbar);
            const frame = this.selectionCoordinator.getCurrentFrame() ?? this.selectionCoordinator.refreshNow();
            if (frame && this.selectionToolbarEnabled && this.initialized) this.showToolbar(frame, selectionKey(frame));
        }
        const persist = settings.persistAnnotations ?? false;
        if (persist !== this.persistEnabled) {
            this.persistEnabled = persist;
            this.store.setPersistEnabled(persist);
        }
        if (settings.commentExport) this.commentExportSettings = settings.commentExport;
    }

    /**
     * Compose the current page annotations with the same export semantics used
     * by Reader. The Prompt autocomplete controller receives only this narrow
     * value-producing seam and never owns annotation records or settings.
     */
    composeCurrentAnnotations(userPrompt = ''): string {
        if (!this.featureEnabled || !this.annotationsEnabled) return '';
        return this.composeAnnotations(this.store.listForConversation('position'), userPrompt);
    }

    getLibraryAnnotations(): ReaderCommentRecord[] {
        const document = this.store.getDocument();
        return document ? this.store.listForConversation().map(record => ({...record, document, target: record.target ?? this.targetFromItemId(record) ?? undefined})) : [];
    }
    subscribeLibraryAnnotations(listener: () => void): () => void { return this.store.onChange(listener); }
    async updateLibraryAnnotation(record: ReaderCommentRecord): Promise<void> { await this.store.update(record, record.target ?? null); }
    async removeLibraryAnnotation(record: ReaderCommentRecord): Promise<void> { await this.store.remove(record); }
    canInsertLibraryAnnotation(record: ReaderCommentRecord): boolean {
        const current = this.store.getDocument();
        return !!record.document && !!current && readerAnnotationDocumentKey(record.document) === readerAnnotationDocumentKey(current);
    }
    async insertLibraryAnnotation(record: ReaderCommentRecord): Promise<void> {
        if (!this.canInsertLibraryAnnotation(record)) throw new Error('Annotation source changed');
        await this.insertAnnotations([record]);
    }
    composeLibraryAnnotation(record: ReaderCommentRecord): string { return this.composeAnnotations([record]); }

    // ---------- selection → toolbar ----------

    private readonly handleSelectionFrame = (frame: ChatGPTPageSelectionFrame | null): void => {
        if (!this.selectionToolbarEnabled) {
            if (this.mode === 'actions') this.closeToolbar();
            return;
        }
        if (this.mode === 'editing') return;
        // A toolbar pointer action owns the selection until its click finishes.
        if (this.toolbarActionActive) return;
        if (!frame) {
            this.closeToolbar();
            return;
        }
        const key = selectionKey(frame);
        this.lastFrame = frame;
        if (this.pointerAnchor && this.pointerAnchor.key !== key) this.pointerAnchor = null;
        if (this.toolbarKey && this.toolbarKey !== key) this.closeToolbar();
        // During a drag the coordinator only updates this lightweight frame.
        // Once the pointer is released, or when a keyboard/programmatic
        // selection settles without an active drag, the same frame can open the
        // toolbar without a second semantic capture pass.
        if (!this.pointerSelectionActive && this.mode === 'closed') this.showToolbar(frame, key);
    };

    private readonly handlePointerUp = (event: PointerEvent): void => {
        if (event.button !== 0) {
            this.pointerSelectionActive = false;
            return;
        }
        this.pointerSelectionActive = false;
        if (this.mode === 'editing') return;
        if (event.composedPath().includes(this.ensureOverlay().getHost())) return;
        if (event.composedPath().some(node => node instanceof HTMLElement && node.dataset.aimdRole === 'chatgpt-page-annotation-markers')) return;
        this.settleToolbarFromPointer(event);
    };

    private showToolbar(frame: ChatGPTPageSelectionFrame, key: string): void {
        if (!this.selectionToolbarEnabled) return;
        if (!this.renderToolbar(frame)) {
            this.closeToolbar();
            return;
        }
        this.lastKey = key;
        this.mode = 'actions';
        this.toolbarKey = key;
    }

    private closeToolbar(): void {
        this.mode = 'closed';
        this.lastSelection = null;
        this.lastFrame = null;
        this.lastKey = '';
        this.toolbarKey = null;
        this.pointerAnchor = null;
        this.toolbarActionActive = false;
        this.actionSnapshot = null;
        this.ensureOverlay().renderToolbar(null);
    }

    private renderToolbar(frame: ChatGPTPageSelectionFrame): boolean {
        const canHighlight = this.selectionToolbarActions.highlight && isHighlightableTextSelection(frame.location.range, frame.location.root);
        if (!this.selectionToolbarActions.copy && !(this.selectionToolbarActions.annotation && this.annotationsEnabled) && !canHighlight) {
            this.ensureOverlay().renderToolbar(null);
            return false;
        }
        const position = this.resolveToolbarPosition(frame, canHighlight);
        if (!position) {
            this.ensureOverlay().renderToolbar(null);
            return false;
        }
        this.ensureOverlay().renderToolbar({
            left: position.left,
            top: position.top,
            copyLabel: this.getLabel('btnCopy', 'Copy Markdown'),
            commentLabel: this.getLabel('readerCommentAddTitle', 'Add annotation'),
            onActionPointerDown: () => {
                this.toolbarActionActive = true;
                this.actionSnapshot = this.resolveActionSnapshot();
            },
            onActionPointerCancel: () => {
                this.toolbarActionActive = false;
                this.actionSnapshot = null;
            },
            onCopy: () => void this.copyCurrentSelection(),
            onComment: () => this.openCreateCommentFromCurrentSelection(),
            copyEnabled: this.selectionToolbarActions.copy,
            commentEnabled: this.annotationsEnabled && this.selectionToolbarActions.annotation,
            onHighlight: canHighlight ? color => this.saveHighlight(color) : undefined,
        });
        return true;
    }

    private resolveToolbarPosition(frame: ChatGPTPageSelectionFrame, canHighlight: boolean): { left: number; top: number } | null {
        if (this.pointerAnchor && this.pointerAnchor.key === selectionKey(frame)) {
            const buttonSize = this.readPxVar('--aimd-size-control-icon-panel', 32);
            const pointerGap = this.readPxVar('--aimd-space-2', 8);
            const pointerEdge = this.readPxVar('--aimd-space-3', 12);
            const count = Number(this.selectionToolbarActions.copy) + Number(this.annotationsEnabled && this.selectionToolbarActions.annotation) + (canHighlight ? 3 : 0);
            const actionWidth = buttonSize * count + pointerGap * Math.max(0, count - 1);
            let left = this.pointerAnchor.x + pointerGap;
            if (left + actionWidth > window.innerWidth - pointerEdge) {
                left = Math.max(pointerEdge, this.pointerAnchor.x - actionWidth - pointerGap);
            }
            let top = this.pointerAnchor.y + pointerGap;
            if (top + buttonSize > window.innerHeight - pointerEdge) {
                top = Math.max(pointerEdge, this.pointerAnchor.y - buttonSize - pointerGap);
            }
            return { left: Math.max(pointerEdge, left), top: Math.max(pointerEdge, top) };
        }
        const layout = resolveSelectionLayout({
            root: frame.location.root,
            range: frame.location.range,
            selectedUnits: frame.renderedAtomicUnits,
        });
        if (!layout.unionRect) return null;
        const rootRect = frame.location.root.getBoundingClientRect();
        const viewport = {
            left: rootRect.left + layout.unionRect.left,
            top: rootRect.top + layout.unionRect.top,
            width: layout.unionRect.width,
            height: layout.unionRect.height,
        };
        const buttonSize = this.readPxVar('--aimd-size-control-icon-panel', 32);
        const gap = this.readPxVar('--aimd-space-2', 8);
        const edge = this.readPxVar('--aimd-space-3', 12);
        const actionWidth = buttonSize * (canHighlight ? (this.annotationsEnabled ? 5 : 4) : (this.annotationsEnabled ? 2 : 1)) + gap * (canHighlight ? 3 : 1);
        const left = Math.max(edge, Math.min(
            viewport.left + viewport.width / 2 - actionWidth / 2,
            window.innerWidth - actionWidth - edge,
        ));
        const preferredTop = viewport.top - buttonSize - gap;
        const fallbackTop = viewport.top + viewport.height + gap;
        const top = preferredTop >= edge ? preferredTop : fallbackTop;
        return { left, top: Math.max(edge, top) };
    }

    private async copyCurrentSelection(): Promise<void> {
        const snapshot = this.resolveActionSnapshot();
        if (!snapshot) {
            this.reportSelectionUnavailable();
            return;
        }
        const ok = await copyCanonicalMarkdownToClipboard(snapshot.canonicalMarkdown, snapshot.literal);
        showToast({
            text: ok
                ? this.getLabel('btnCopied', 'Copied!')
                : this.getLabel('copyFailed', 'Copy failed'),
            tone: ok ? 'success' : 'error',
        });
    }

    private async saveHighlight(color: HighlightColor): Promise<void> {
        if (this.highlightSaving) return;
        const snapshot = this.resolveActionSnapshot();
        const target = snapshot ? this.resolveTarget(snapshot.evidence) : null;
        if (!snapshot || !target || !this.isSnapshotCurrent(snapshot)
            || !isHighlightableTextSelection(snapshot.range, snapshot.root)) { this.reportSelectionUnavailable(); return; }
        this.highlightSaving = true;
        try {
            const record = createPageCommentRecord({ id: `highlight-${crypto.randomUUID()}`, itemId: this.itemIdForEvidence(snapshot.evidence), comment: '', range: snapshot.range, root: snapshot.root, sourceMarkdown: snapshot.canonicalMarkdown });
            await this.highlights.create(createHighlightRecord(record, target, color));
            this.closeToolbar();
        } catch (error) { this.showHighlightError(error, 'highlightSaveFailed', 'Could not save highlight'); }
        finally { this.highlightSaving = false; }
    }

    private resolveActionSnapshot(): PageMarkdownSelectionSnapshot | null {
        if (this.toolbarActionActive && this.actionSnapshot && this.isSnapshotCurrent(this.actionSnapshot)) {
            return this.actionSnapshot;
        }
        const frame = this.selectionCoordinator.refreshNow();
        if (!frame) {
            if (this.toolbarActionActive && this.lastSelection?.root.isConnected && this.isSnapshotCurrent(this.lastSelection)) {
                return this.lastSelection;
            }
            return null;
        }
        this.lastFrame = frame;
        const key = selectionKey(frame);
        if (this.lastSelection
            && this.lastKey === key
            && this.lastSelection.root.isConnected
            && this.isSnapshotCurrent(this.lastSelection)) {
            return this.lastSelection;
        }
        const snapshot = this.markdownResolver.resolve(frame);
        this.lastSelection = snapshot;
        this.lastKey = key;
        return snapshot;
    }

    private isSnapshotCurrent(snapshot: PageMarkdownSelectionSnapshot): boolean {
        return isPageMarkdownSelectionSnapshotCurrent(snapshot);
    }

    private openCreateCommentFromCurrentSelection(): void {
        const snapshot = this.resolveActionSnapshot();
        if (snapshot) this.openCreateComment(snapshot);
        else this.reportSelectionUnavailable();
    }

    private reportSelectionUnavailable(): void {
        showToast({
            text: this.getLabel('pageAnnotationSelectionUnavailable', 'Selection unavailable. Select text again and try.'),
            tone: 'error',
        });
        this.closeToolbar();
    }

    // ---------- comment popover ----------

    private openCreateComment(snapshot: PageMarkdownSelectionSnapshot): void {
        this.closeToolbar();
        this.mode = 'editing';
        this.commentPopover.open({
            shadow: this.ensureOverlay().getShadow(),
            container: this.ensureOverlay().getContainer(),
            appearance: this.appearance,
            selectedSource: snapshot.canonicalMarkdown,
            anchorRect: this.selectionViewportRect(snapshot),
            mode: 'create',
            labels: this.commentLabels(),
            onSave: (value) => this.saveNewAnnotation(snapshot, value),
            onCancel: () => {
                this.closeToolbar();
            },
        });
    }

    private async saveNewAnnotation(snapshot: PageMarkdownSelectionSnapshot, value: string): Promise<void> {
        const target = this.resolveTarget(snapshot.evidence);
        const record = createPageCommentRecord({
            id: `${ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            itemId: this.itemIdForEvidence(snapshot.evidence),
            comment: value,
            range: snapshot.range,
            root: snapshot.root,
            sourceMarkdown: snapshot.canonicalMarkdown,
        });
        record.target = target ?? undefined;
        try {
            const document = this.store.getDocument();
            if (document) await this.store.bindDocument(readMarkDocumentTitle(document));
            const saved = await this.store.create(record, target);
            this.activeAnnotationId = saved.id;
        } catch (error) {
            showToast({
                text: error instanceof Error ? error.message : this.getLabel('readerCommentPersistenceUnavailable', 'Annotation could not be saved.'),
                tone: 'error',
            });
            throw error;
        }
        this.closeToolbar();
        this.syncAnnotationSurface();
    }

    private openEditComment(record: ReaderCommentRecord, anchorRect: DOMRect): void {
        this.closeHighlightActions();
        this.activeAnnotationId = record.id;
        this.closeToolbar();
        this.mode = 'editing';
        this.commentPopover.open({
            shadow: this.ensureOverlay().getShadow(),
            container: this.ensureOverlay().getContainer(),
            appearance: this.appearance,
            selectedSource: record.sourceMarkdown,
            anchorRect: {
                left: anchorRect.left,
                top: anchorRect.top,
                width: anchorRect.width,
                height: anchorRect.height,
                right: anchorRect.right,
                bottom: anchorRect.bottom,
            },
            mode: 'edit',
            labels: this.commentLabels(),
            initialText: record.comment,
            onSave: async (value) => {
                try {
                    await this.store.update({ ...record, comment: value, updatedAt: Date.now() }, record.target ?? this.targetFromItemId(record));
                    this.activeAnnotationId = record.id;
                } catch (error) {
                    showToast({
                        text: error instanceof Error ? error.message : this.getLabel('readerCommentPersistenceUnavailable', 'Annotation could not be saved.'),
                        tone: 'error',
                    });
                    throw error;
                }
                this.closeToolbar();
                this.syncAnnotations();
            },
            onDelete: async () => {
                try {
                    await this.store.remove(record);
                } catch (error) {
                    showToast({
                        text: error instanceof Error ? error.message : this.getLabel('readerCommentPersistenceUnavailable', 'Annotation could not be deleted.'),
                        tone: 'error',
                    });
                    throw error;
                }
                this.activeAnnotationId = null;
                this.closeToolbar();
                this.syncAnnotationSurface();
                showToast({ text: this.getLabel('readerCommentDeleted', 'Annotation deleted'), tone: 'success' });
            },
            onCancel: () => {
                this.closeToolbar();
                this.syncAnnotations();
            },
        });
    }

    private selectionViewportRect(snapshot: PageMarkdownSelectionSnapshot): DOMRect {
        const layout = resolveSelectionLayout({
            root: snapshot.root,
            range: snapshot.range,
            selectedUnits: snapshot.units,
        });
        const rootRect = snapshot.root.getBoundingClientRect();
        const union = layout.unionRect ?? { left: 0, top: 0, width: 0, height: 0 };
        return new DOMRect(
            rootRect.left + union.left,
            rootRect.top + union.top,
            union.width,
            union.height,
        );
    }

    private commentLabels(): {
        addTitle: string;
        editTitle: string;
        close: string;
        selectedSource: string;
        placeholder: string;
        cancel: string;
        delete: string;
        save: string;
        saveShortcut: string;
    } {
        return {
            addTitle: this.getLabel('readerCommentAddTitle', 'Add comment'),
            editTitle: this.getLabel('readerCommentEditTitle', 'Edit comment'),
            close: this.getLabel('btnClose', 'Close'),
            selectedSource: this.getLabel('readerCommentSelectedSource', 'Selected content'),
            placeholder: this.getLabel('readerCommentPlaceholder', 'Write your annotation...'),
            cancel: this.getLabel('btnCancel', 'Cancel'),
            delete: this.getLabel('btnDelete', 'Delete'),
            save: this.getLabel('readerCommentSave', 'Save annotation'),
            saveShortcut: this.getLabel('readerCommentSaveShortcut', 'Ctrl/Cmd + Enter to save'),
        };
    }

    // ---------- in-DOM markers ----------

    private syncAnnotationSurface(): void {
        const records = this.annotationsEnabled ? this.store.listForConversation('position') : [];
        this.syncAnnotations(records);
        this.syncChip(records);
    }

    private syncAnnotations(records = this.store.listForConversation('position')): void {
        records = this.annotationsEnabled ? [...records] : [];
        const colors = new Map(this.highlights.list().map(record => [`highlight:${record.id}`, record.color]));
        records.push(...this.highlights.list().map(highlightAnchor));
        const syncKey = [
            this.lastDocumentKey ?? '',
            this.lastMaterializationToken ?? '',
            String(this.markerLayoutEpoch),
            this.activeAnnotationId ?? '',
            this.activeHighlightId ?? '',
            records.map((record) => `${record.id}:${record.revision ?? ''}:${record.updatedAt}`).join(','),
        ].join('|');
        if (syncKey === this.lastAnnotationsSyncKey) return;
        this.lastAnnotationsSyncKey = syncKey;
        const activeRecordIds = new Set(records.map((record) => record.id));
        for (const id of this.anchorCache.keys()) {
            if (!activeRecordIds.has(id)) this.anchorCache.delete(id);
        }
        const entriesByAssistant = new Map<string, HTMLElement>();
        for (const entry of this.materialization?.read().entries ?? []) {
            if (entry.target.assistantMessageId && entry.messageElement) {
                entriesByAssistant.set(entry.target.assistantMessageId, entry.messageElement);
            }
        }
        const byRoot = new Map<HTMLElement, {
            highlights: Array<{ left: number; top: number; width: number; height: number; color?: HighlightColor; active?: boolean }>;
            anchors: MarkersAnchorRender[];
            occupiedTops: number[];
            signature: string[];
            rootRect: DOMRect;
            buttonSize: number;
            gap: number;
            stackStep: number;
            gutterWidth: number;
            indicatorWidth: number;
            indicatorHeight: number;
        }>();

        for (const record of records) {
            if (colors.has(record.id)) {
                const messageId = record.target?.assistantMessageId;
                if (!messageId || !entriesByAssistant.has(messageId)) { this.anchorCache.delete(record.id); continue; }
                const cached = this.anchorCache.get(record.id);
                const currentRoot = this.resolveAnnotationRoot(record, entriesByAssistant);
                if (cached && (cached.root !== currentRoot || !cached.range || !cached.root.contains(cached.range.commonAncestorContainer))) this.anchorCache.delete(record.id);
            }
            const resolved = this.resolveRecordAnchor(record, entriesByAssistant);
            if (!resolved) continue;
            const { root, layout } = resolved;
            const union = layout.unionRect;
            if (!union) {
                this.markAnchorState(record, 'unanchored');
                continue;
            }
            this.markAnchorState(record, 'anchored');
            let bucket = byRoot.get(root);
            if (!bucket) {
                const rootRect = root.getBoundingClientRect();
                const buttonSize = this.readPxVar('--aimd-size-control-icon-panel', 32);
                const gap = this.readPxVar('--aimd-space-2', 8);
                bucket = {
                    highlights: [],
                    anchors: [],
                    occupiedTops: [],
                    signature: [],
                    rootRect,
                    buttonSize,
                    gap,
                    stackStep: buttonSize + this.readPxVar('--aimd-space-1', 4),
                    gutterWidth: this.resolveGutterSpace(rootRect),
                    indicatorWidth: this.readPxVar('--aimd-space-2', 8),
                    indicatorHeight: this.readPxVar('--aimd-size-control-compact', 24),
                };
                byRoot.set(root, bucket);
            }
            for (const rect of layout.rects) {
                bucket.highlights.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, color: colors.get(record.id), active: record.id === `highlight:${this.activeHighlightId}` });
            }
            // The anchor lives in the whitespace right of the text column
            // (Reader-style gutter) so it never covers the body text. When the
            // column fills the viewport there is no gutter: hide the button and
            // keep access through the composer chip / manager.
            const color = colors.get(record.id);
            let placedAnchor: MarkersAnchorRender | null = null;
            if (bucket.gutterWidth >= bucket.gap + (color ? bucket.indicatorWidth : bucket.buttonSize)) {
                let slotTop = Math.max(0, union.top + union.height / 2 - bucket.buttonSize / 2);
                while (bucket.occupiedTops.some((value) => Math.abs(value - slotTop) < bucket.stackStep)) {
                    slotTop += bucket.stackStep;
                }
                bucket.occupiedTops.push(slotTop);
                if (color) {
                    placedAnchor = {
                        id: record.id,
                        kind: 'highlight',
                        color,
                        active: record.id === `highlight:${this.activeHighlightId}`,
                        left: bucket.rootRect.width + bucket.gap + (bucket.gutterWidth >= bucket.gap + bucket.buttonSize ? (bucket.buttonSize - bucket.indicatorWidth) / 2 : 0),
                        top: slotTop + (bucket.buttonSize - bucket.indicatorHeight) / 2,
                        label: this.getLabel(color === 'blue' ? 'highlightColorBlue' : color === 'yellow' ? 'highlightColorYellow' : 'highlightColorRed', 'Highlight'),
                        onOpen: button => this.openHighlightActions(record.id.slice('highlight:'.length), button),
                    };
                } else {
                    placedAnchor = {
                        id: record.id,
                        left: bucket.rootRect.width + bucket.gap,
                        top: slotTop,
                        active: record.id === this.activeAnnotationId,
                        label: this.getLabel('pageAnnotationOpen', 'Open annotation'),
                        onOpen: () => {
                            const rect = new DOMRect(
                                bucket!.rootRect.left + union.left,
                                bucket!.rootRect.top + union.top,
                                union.width,
                                union.height,
                            );
                            this.openEditComment(record, rect);
                        },
                    };
                }
                bucket.anchors.push(placedAnchor);
            }
            bucket.signature.push([
                record.id,
                colors.get(record.id) ?? '',
                record.updatedAt,
                colors.has(record.id) ? JSON.stringify(layout.rects) : '',
                union.left,
                union.top,
                union.width,
                union.height,
                record.id === this.activeAnnotationId ? 'active' : 'idle',
                record.id === `highlight:${this.activeHighlightId}` ? 'active' : 'idle',
                bucket.rootRect.width,
                placedAnchor?.left ?? '',
                placedAnchor?.top ?? '',
            ].join(':'));
        }

        this.markers.render([...byRoot.entries()].map(([root, bucket]) => ({
            root,
            highlights: bucket.highlights,
            anchors: bucket.anchors,
            signature: bucket.signature.join('|'),
        })));
    }

    private resolveRecordAnchor(
        record: ReaderCommentRecord,
        entriesByAssistant: Map<string, HTMLElement>,
    ): { root: HTMLElement; layout: { range: Range | null; units: readonly { element: HTMLElement }[]; rects: ReaderCommentRect[]; unionRect: ReaderCommentRect | null } } | null {
        const cached = this.anchorCache.get(record.id);
        if (cached && cached.root.isConnected) {
            // The cached Range stays valid as long as its root is still mounted;
            // surface churn elsewhere (scrolling, streaming commits) must not
            // re-run the TreeWalker re-anchor for every annotation.
            if (
                cached.layout
                && cached.layoutEpoch === this.markerLayoutEpoch
                && cached.revision === record.revision
                && cached.updatedAt === record.updatedAt
            ) {
                return { root: cached.root, layout: cached.layout };
            }
            const layout = resolveSelectionLayout({ root: cached.root, range: cached.range, selectedUnits: [] });
            cached.layout = layout.unionRect ? layout : null;
            cached.layoutEpoch = this.markerLayoutEpoch;
            cached.revision = record.revision;
            cached.updatedAt = record.updatedAt;
            return {
                root: cached.root,
                layout,
            };
        }
        const root = this.resolveAnnotationRoot(record, entriesByAssistant);
        if (!root) {
            this.anchorCache.delete(record.id);
            this.markAnchorState(record, 'unanchored');
            return null;
        }
        const resolved = resolveReaderCommentAnchor(root, record);
        this.anchorCache.set(record.id, {
            root,
            range: resolved.range,
            layout: resolved.unionRect ? resolved : null,
            layoutEpoch: this.markerLayoutEpoch,
            revision: record.revision,
            updatedAt: record.updatedAt,
        });
        return { root, layout: resolved };
    }

    private resolveAnnotationRoot(
        record: ReaderCommentRecord,
        entriesByAssistant?: Map<string, HTMLElement>,
    ): HTMLElement | null {
        if (!this.materialization) return null;
        const assistantMessageId = record.target?.assistantMessageId
            ?? this.assistantMessageIdFromItemId(record.itemId);
        const messageElement = entriesByAssistant?.get(assistantMessageId)
            ?? this.findMessageElement(assistantMessageId);
        if (!messageElement || !messageElement.isConnected) return null;
        const cached = this.annotationRootCache.get(messageElement);
        if (cached?.isConnected && messageElement.contains(cached)) return cached;
        const root = listMessageContentRoots(this.adapter, messageElement)[0] ?? null;
        if (root) this.annotationRootCache.set(messageElement, root);
        return root;
    }

    private findMessageElement(assistantMessageId: string): HTMLElement | null {
        const entry = this.materialization!.read().entries.find((candidate) => (
            candidate.target.assistantMessageId === assistantMessageId
        ));
        return entry?.messageElement
            ?? (entry?.anchorElement instanceof HTMLElement ? entry.anchorElement.closest<HTMLElement>(this.adapter.getMessageSelector()) : null);
    }

    private markAnchorState(record: ReaderCommentRecord, state: 'anchored' | 'unanchored'): void {
        // Virtualization and Reader rendering have independent anchor availability.
        // A layout pass must never advance the shared annotation revision.
        record.lastKnownAnchorState = state;
    }

    private openHighlightActions(id: string, button: HTMLButtonElement): void {
        const record = this.highlights.list().find(item => item.id === id);
        if (!record) return;
        const documentKey = this.lastDocumentKey;
        const reveal = this.revealHighlightSource(`highlight:${id}`);
        const show = (): void => {
            if (!this.initialized || documentKey !== this.lastDocumentKey) return;
            const currentButton = button.isConnected ? button : this.markers.findHighlight(`highlight:${id}`);
            const currentRecord = this.highlights.list().find(item => item.id === id);
            if (!currentButton || !currentRecord) return;
            const anchorRect = currentButton.getBoundingClientRect();
            this.commentPopover.close(this.ensureOverlay().getShadow(), false);
            this.closeToolbar();
            this.activeHighlightId = id;
            this.syncAnnotations();
            this.markers.findHighlight(`highlight:${id}`)?.focus({ preventScroll: true });
            this.ensureOverlay().renderHighlightActions({
                anchorRect,
                color: currentRecord.color,
                deleteLabel: this.getLabel('btnDelete', 'Delete'),
                onColor: color => this.changeHighlight(id, color, documentKey),
                onDelete: () => this.deleteHighlight(id, documentKey),
            });
        };
        if (reveal) window.requestAnimationFrame(show);
        else show();
    }

    private revealHighlightSource(key: string): boolean {
        const cached = this.anchorCache.get(key);
        const range = cached?.range;
        const union = cached?.layout?.unionRect;
        if (!cached?.root.isConnected || !range || !union) return false;
        const top = cached.root.getBoundingClientRect().top + union.top;
        if (top >= 0 && top + union.height <= window.innerHeight) return false;
        const source = range.startContainer instanceof Element
            ? range.startContainer
            : range.startContainer.parentElement;
        if (!source) return false;
        source.scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
    }

    private closeHighlightActions(): void {
        if (!this.activeHighlightId) return;
        this.activeHighlightId = null;
        this.overlay?.renderHighlightActions(null);
        this.syncAnnotations();
    }

    private async changeHighlight(id: string, color: HighlightColor, documentKey: string | null): Promise<void> {
        if (!documentKey || documentKey !== this.lastDocumentKey) return;
        const record = this.highlights.list().find(item => item.id === id);
        if (!record) return;
        try {
            if (record.color !== color) await this.highlights.updateColor(record, color);
            this.closeHighlightActions();
        } catch (error) { this.showHighlightError(error, 'highlightSaveFailed', 'Could not save highlight'); }
    }

    private async deleteHighlight(id: string, documentKey: string | null): Promise<void> {
        if (!documentKey || documentKey !== this.lastDocumentKey) return;
        const record = this.highlights.list().find(item => item.id === id);
        if (!record) return;
        try {
            await this.highlights.remove(record);
            this.closeHighlightActions();
        } catch (error) { this.showHighlightError(error, 'highlightDeleteFailed', 'Could not delete highlight'); }
    }

    private showHighlightError(error: unknown, key: string, fallback: string): void {
        const text = error instanceof RuntimeClientRequestError && error.failure.kind === 'transport'
            ? getRuntimeFailurePresentation(error.failure, (label, defaultValue) => this.getLabel(label, defaultValue)).message
            : this.getLabel(key, fallback);
        showToast({ text, tone: 'error' });
    }

    // ---------- chip ----------

    private syncChip(records = this.store.listForConversation('position')): void {
        const mount = this.annotationsEnabled && records.length > 0 ? this.composerMount() : null;
        this.composerChip.render(mount, records.length, {
            onOpenManager: () => this.openManager(),
            label: this.getLabel('pageAnnotationChipAction', 'Open current-conversation annotations'),
        });
    }

    private composerMount(): { container: HTMLElement; anchor: HTMLElement } | null {
        const composer = this.adapter.getComposerInputElement?.() ?? null;
        if (!(composer instanceof HTMLElement) || !composer.isConnected) return null;
        return findChatGPTComposerInputEnhancementMount(composer);
    }

    private readonly handleFocusIn = (): void => {
        // The composer can be replaced by ChatGPT hydration; re-seat the chip
        // when it should be visible but its host was removed with the old DOM.
        if (this.annotationsEnabled && !this.composerChip.isConnected()) this.syncChip();
    };

    // ---------- manager ----------

    private ensureManagerSession(): OverlaySession {
        if (this.managerSession) return this.managerSession;
        this.managerSession = new OverlaySession({
            id: 'aimd-chatgpt-page-annotation-manager-host',
            theme: this.appearance.theme,
            themeOverrides: this.appearance.overrides,
            surfaceCss: '',
            lockScroll: true,
            zIndex: 'var(--aimd-z-tooltip)',
            surfaceStyleId: 'aimd-chatgpt-page-annotation-manager-surface',
            overlayStyleId: 'aimd-chatgpt-page-annotation-manager-overlay',
        });
        return this.managerSession;
    }

    private openManager(): void {
        const session = this.ensureManagerSession();
        this.manager.open({
            shadow: session.shadow,
            modalHost: session.modalHost,
            anchorRect: this.composerViewportRect(),
            getCurrentRecords: () => this.store.listForConversation('position'),
            getCurrentLoadFailure: () => this.store.getLoadFailure() !== null,
            retryCurrent: () => this.store.reload(),
            loadAll: () => this.store.listAllRecords(),
            onSelect: (record) => void this.locateAndEdit(record),
            onDelete: async (record) => {
                try {
                    await this.store.remove(record);
                } catch (error) {
                    showToast({ text: error instanceof Error ? error.message : this.getLabel('readerCommentPersistenceUnavailable', 'Annotation could not be deleted.'), tone: 'error' });
                    return false;
                }
                this.activeAnnotationId = null;
                this.syncAnnotationSurface();
                return true;
            },
            onInsertAll: (records) => this.insertAnnotations(records),
            onInsertAndDelete: (records) => this.insertAnnotations(records, true),
        });
    }

    private composerViewportRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } | null {
        const composer = this.adapter.getComposerInputElement?.() ?? null;
        if (!(composer instanceof HTMLElement) || !composer.isConnected) return null;
        const rect = composer.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
    }

    private async locateAndEdit(record: ReaderCommentRecord): Promise<void> {
        if (this.navigation && record.target?.assistantMessageId) {
            const result = await this.navigation.navigate({
                position: record.target.position ?? 0,
                roundId: record.target.roundId ?? null,
                userMessageId: record.target.userMessageId ?? null,
                assistantMessageId: record.target.assistantMessageId,
                source: 'reader',
            }, { timeoutMs: 15000, align: 'start' });
            if (!result.ok) {
                showToast({ text: this.getLabel('pageAnnotationSourceUnavailable', 'The source reply is not available on this page.'), tone: 'error' });
                return;
            }
        }
        const root = this.resolveAnnotationRoot(record);
        const resolved = root ? resolveReaderCommentAnchor(root, record) : null;
        if (!root || !resolved?.unionRect) {
            showToast({ text: this.getLabel('pageAnnotationSourceUnavailable', 'The source reply is not available on this page.'), tone: 'error' });
            return;
        }
        const rootRect = root.getBoundingClientRect();
        const rect = new DOMRect(
            rootRect.left + resolved.unionRect.left,
            rootRect.top + resolved.unionRect.top,
            resolved.unionRect.width,
            resolved.unionRect.height,
        );
        this.openEditComment(record, rect);
    }

    // ---------- document / source sync ----------

    private readonly handleSourceChanged = (): void => {
        if (this.sourceRafId !== null) return;
        this.sourceRafId = window.requestAnimationFrame(() => {
            this.sourceRafId = null;
            this.ensureOverlay().ensureMounted();
            const documentKey = this.contentSource?.read().document?.key ?? null;
            const materializationToken = this.materialization?.read().materializationToken ?? '';
            if (documentKey !== this.lastDocumentKey) {
                this.lastDocumentKey = documentKey;
                void this.syncDocument();
            } else if (materializationToken !== this.lastMaterializationToken) {
                this.lastMaterializationToken = materializationToken;
                this.closeHighlightActions();
                this.annotationRootCache = new WeakMap<HTMLElement, HTMLElement>();
                this.markerLayoutEpoch += 1;
                this.syncAnnotationSurface();
            }
            if (this.mode === 'actions' && this.lastSelection && !this.lastSelection.root.isConnected) {
                this.closeToolbar();
            }
        });
    };

    private async syncDocument(): Promise<void> {
        if (!this.contentSource) return;
        const previousKey = this.lastDocumentKey;
        const state = this.contentSource.read();
        const sourceDocument = createReaderAnnotationDocument(state.document, this.pageUrl());
        const annotationDocument = sourceDocument ? readMarkDocumentTitle(sourceDocument) : undefined;
        const nextKey = annotationDocument ? readerAnnotationDocumentKey(annotationDocument) : null;
        if (previousKey !== null && previousKey !== nextKey) {
            // Conversation identity changed: close transient UI before swapping data.
            this.commentPopover.close(this.ensureOverlay().getShadow(), false);
            this.mode = 'closed';
            this.manager.close();
            this.closeToolbar();
            this.activeAnnotationId = null;
            this.activeHighlightId = null;
            this.overlay?.renderHighlightActions(null);
            this.anchorCache.clear();
            this.annotationRootCache = new WeakMap<HTMLElement, HTMLElement>();
        }
        this.lastDocumentKey = nextKey;
        this.lastMaterializationToken = this.materialization?.read().materializationToken ?? '';
        this.annotationRootCache = new WeakMap<HTMLElement, HTMLElement>();
        this.markerLayoutEpoch += 1;
        this.lastAnnotationsSyncKey = null;
        this.turnMeta.clear();
        const snapshot = state.snapshot;
        if (snapshot) {
            for (const turn of snapshot.turns) {
                this.turnMeta.set(turn.identity.assistantMessageId, {
                    roundId: turn.identity.turnId,
                    userMessageId: turn.identity.userMessageId ?? null,
                    position: turn.ordinal,
                });
            }
        }
        this.highlights.bind(state.document?.conversationId ? annotationDocument ?? null : null);
        await this.store.bindDocument(annotationDocument ?? null);
        this.syncAnnotationSurface();
    }

    private readonly handleResize = (): void => {
        if (!this.initialized) return;
        if (this.resizeRafId !== null) return;
        this.resizeRafId = window.requestAnimationFrame(() => {
            this.resizeRafId = null;
            this.ensureOverlay().ensureMounted();
            this.closeHighlightActions();
            this.markerLayoutEpoch += 1;
            if (this.mode === 'actions' && this.lastFrame && !this.renderToolbar(this.lastFrame)) this.closeToolbar();
            this.syncAnnotationSurface();
        });
    };

    private readonly handleMarkerScroll = (): void => {
        this.closeHighlightActions();
    };

    private readonly handlePointerDown = (event: PointerEvent): void => {
        const path = event.composedPath();
        const overlayHost = this.overlay?.getHost();
        if (overlayHost && path.includes(overlayHost)) return;
        if (event.button !== 0) return;
        if (path.some(node => node instanceof HTMLElement && node.dataset.aimdRole === 'chatgpt-page-annotation-markers')) return;
        this.closeHighlightActions();
        this.pointerSelectionActive = true;
        if (this.mode === 'actions') this.closeToolbar();
    };

    private readonly handlePointerCancel = (event: PointerEvent): void => {
        const wasSelecting = this.pointerSelectionActive;
        this.pointerSelectionActive = false;
        if (!wasSelecting || this.mode === 'editing') return;
        if (event.composedPath().includes(this.ensureOverlay().getHost())) return;
        // Chromium can terminate a native text drag with pointercancel when
        // ChatGPT changes pointer capture. The Selection is still valid, so
        // close the gesture through the same final frame path as pointerup.
        this.settleToolbarFromPointer(event);
    };

    private settleToolbarFromPointer(event: PointerEvent): void {
        // refreshNow synchronously notifies the selection listener. Keep the
        // gesture active during that notification so the listener cannot open
        // a geometry-anchored toolbar before this method records the pointer
        // anchor.
        let frame: ChatGPTPageSelectionFrame | null = null;
        this.pointerSelectionActive = true;
        try {
            frame = this.selectionCoordinator.refreshNow();
        } finally {
            this.pointerSelectionActive = false;
        }
        if (!frame) return;
        const key = selectionKey(frame);
        this.pointerAnchor = { x: event.clientX, y: event.clientY, key };
        this.lastFrame = frame;
        this.showToolbar(frame, key);
    }

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return;
        this.closeHighlightActions();
        if (this.mode === 'actions') this.closeToolbar();
    };

    // ---------- composer insert ----------

    private async insertAnnotations(records: ReaderCommentRecord[], deleteAfterInsert = false): Promise<void> {
        if (records.length < 1) {
            showToast({ text: this.getLabel('readerCommentCopyEmpty', 'No annotations to copy yet.'), tone: 'error' });
            return;
        }
        const current = readComposer(this.adapter);
        const document = this.store.getDocument();
        const documentKey = document ? readerAnnotationDocumentKey(document) : null;
        if (!current.ok) {
            showToast({ text: this.getLabel('pageAnnotationInsertFailed', 'Could not insert annotations'), tone: 'error' });
            return;
        }
        // Append at the very end without overwriting the existing draft; keep
        // a blank-line separator when the composer already has content.
        const separator = current.text.trim() ? '\n\n' : '';
        const text = `${separator}${this.composeAnnotations(records)}`;
        const result = await replaceComposerTextRange(this.adapter, {
            start: current.text.length,
            end: current.text.length,
            replacement: text,
            cursorIndex: current.text.length + text.length,
        });
        if (result.ok && deleteAfterInsert) {
            const currentDocument = this.store.getDocument();
            // A route change must not delete records from the newly opened conversation.
            const sameDocument = documentKey !== null && currentDocument !== null
                && readerAnnotationDocumentKey(currentDocument) === documentKey;
            const failed = sameDocument ? await this.store.removeMany(records) : records;
            this.syncAnnotationSurface();
            showToast({
                text: failed.length
                    ? this.getLabel('pageAnnotationInsertedDeleteFailed', 'Inserted. Some annotations could not be deleted and were kept.')
                    : this.getLabel('pageAnnotationInsertedAndDeleted', 'Annotations inserted and deleted'),
                tone: failed.length ? 'error' : 'success',
            });
            return;
        }
        showToast({
            text: result.ok
                ? this.getLabel('pageAnnotationInserted', 'Annotations inserted')
                : this.getLabel('pageAnnotationInsertFailed', 'Could not insert annotations'),
            tone: result.ok ? 'success' : 'error',
        });
    }

    private composeAnnotations(records: ReaderCommentRecord[], userPrompt = ''): string {
        if (records.length < 1) return '';
        return buildCommentsExport(records, {
            ...resolveReaderCommentExportPrompts(this.commentExportSettings),
            userPrompt,
        });
    }

    private resolveGutterSpace(rootRect: DOMRect): number {
        let rightLimit = window.innerWidth;
        try {
            const scrollRoot = this.adapter.getConversationScrollRoot?.() ?? null;
            if (scrollRoot) {
                const scrollRect = scrollRoot.getBoundingClientRect();
                rightLimit = Math.min(scrollRect.right, window.innerWidth);
            }
        } catch {
            // fall back to the viewport edge
        }
        return rightLimit - rootRect.right;
    }

    // ---------- helpers ----------

    private resolveTarget(evidence: ContentSurfaceSelectionEvidenceV1 | null): ReaderAnnotationTarget | null {
        if (!evidence) return null;
        const meta = this.turnMeta.get(evidence.target.assistantMessageId);
        return {
            assistantMessageId: evidence.target.assistantMessageId,
            roundId: meta?.roundId ?? evidence.target.turnId ?? null,
            userMessageId: evidence.target.userMessageId ?? meta?.userMessageId ?? null,
            position: meta?.position ?? null,
        };
    }

    private itemIdForEvidence(evidence: ContentSurfaceSelectionEvidenceV1 | null): string {
        return `chatgpt-${evidence?.target.assistantMessageId ?? ''}`;
    }

    private assistantMessageIdFromItemId(itemId: string): string {
        return itemId.startsWith('chatgpt-') ? itemId.slice('chatgpt-'.length) : itemId;
    }

    private targetFromItemId(record: ReaderCommentRecord): ReaderAnnotationTarget | null {
        return record.target ?? this.resolveTargetFromId(this.assistantMessageIdFromItemId(record.itemId));
    }

    private resolveTargetFromId(assistantMessageId: string): ReaderAnnotationTarget | null {
        const meta = this.turnMeta.get(assistantMessageId);
        if (!assistantMessageId) return null;
        return {
            assistantMessageId,
            roundId: meta?.roundId ?? null,
            userMessageId: meta?.userMessageId ?? null,
            position: meta?.position ?? null,
        };
    }

    private pageUrl(): string {
        return window.location.href.split('#')[0] || window.location.href;
    }

    private ensureOverlay(): PageAnnotationOverlay {
        if (!this.overlay) this.overlay = new PageAnnotationOverlay(this.appearance);
        return this.overlay;
    }

    private readPxVar(name: string, fallback: number): number {
        const cached = this.pxVarCache.get(name);
        if (cached !== undefined) return cached;
        let value = fallback;
        try {
            const parsed = Number.parseFloat(window.getComputedStyle(this.ensureOverlay().getContainer()).getPropertyValue(name).trim());
            if (Number.isFinite(parsed)) value = parsed;
        } catch {
            // keep fallback
        }
        this.pxVarCache.set(name, value);
        return value;
    }

    private getLabel(key: string, fallback: string, substitutions?: string | string[]): string {
        const translated = t(key, substitutions as any);
        if (!translated || translated === key) return fallback;
        return translated;
    }
}

function selectionKey(context: { root?: HTMLElement; range?: Range; location?: ChatGPTPageSelectionFrame['location'] }): string {
    const location = context.location;
    const root = location?.root ?? context.root;
    const range = location?.range ?? context.range;
    if (!root || !range) return '';
    return [
        objectIdentity(root),
        objectIdentity(range.startContainer),
        range.startOffset,
        objectIdentity(range.endContainer),
        range.endOffset,
    ].join('|');
}

const selectionObjectIds = new WeakMap<object, number>();
let nextSelectionObjectId = 1;

function objectIdentity(value: object): number {
    const existing = selectionObjectIds.get(value);
    if (existing !== undefined) return existing;
    const id = nextSelectionObjectId++;
    selectionObjectIds.set(value, id);
    return id;
}
