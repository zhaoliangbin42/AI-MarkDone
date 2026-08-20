import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { ConversationDiscoveryContentPortV1 } from '../../contracts/conversationDiscovery';
import type { ConversationNavigationPortV1 } from '../../contracts/conversationNavigation';
import type { ConversationSurfacePortV1 } from '../../contracts/conversationSurface';
import {
    createConversationPageDocumentKeyV1,
    type ConversationContentStateV1,
    type ConversationDocumentRefV1,
} from '../../contracts/conversationContent';
import type { DiscoveryDiagnosticsSnapshotV1 } from '../../contracts/conversationDiscoveryDiagnostics';
import { ConversationContentRepository } from '../../services/content/ConversationContentRepository';
import { DiscoveryDiagnostics } from '../../services/content/DiscoveryDiagnostics';
import { ChatGPTConversationDiscoveryAdapter } from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';
import { ChatGPTConversationSurface } from '../../drivers/content/chatgpt/ChatGPTConversationSurface';
import { ChatGPTConversationHostMonitor } from '../../drivers/content/chatgpt/ChatGPTConversationHostMonitor';
import { getChatGPTPageIndex } from '../../drivers/content/chatgpt/domConversationDiscovery';
import type { ChatGPTPageIndex } from '../../drivers/content/chatgpt/ChatGPTPageIndex';

export type ChatGPTConversationContentRuntimeOptions = Readonly<{
    /** Test seam; production uses the 400ms stable-host quiet window. */
    hostSettleDelayMs?: number;
}>;

const PAGE_LIFECYCLE_WAKE_COALESCE_MS = 50;
let pageEpochSequence = 0;

/**
 * ChatGPT composition root. The published content/materialization ports are
 * backed by one identity-proven Graph/stable-host Repository and one shared
 * DOM materialization adapter. Either input may establish the same monotonic
 * pool. No consumer may introduce another content observer, repository, or
 * extraction path.
 *
 * The `source` and `materialization` fields are read-only projections.
 * The graph adapter only peeks at evidence captured from the website's own
 * conversation response. It never issues a conversation request.
 */
export class ChatGPTConversationContentRuntime {
    readonly source: ConversationDiscoveryContentPortV1;
    readonly surface: ConversationSurfacePortV1 & ChatGPTConversationSurface;
    readonly materialization: ConversationMaterializationPortV1 & { dispose(): void };
    private readonly graphAdapter: ChatGPTConversationDiscoveryAdapter;
    private readonly repository: ConversationContentRepository;
    private readonly hostMonitor: ChatGPTConversationHostMonitor;
    private readonly pageIndex: ChatGPTPageIndex;
    private readonly pageDocument: ConversationDocumentRefV1;
    private readonly diagnostics = new DiscoveryDiagnostics();
    private lastBridgeDiagnosticsPullAt = 0;
    private unsubscribeGraph: (() => void) | null = null;
    private unsubscribePage: (() => void) | null = null;
    private lastDocumentKey: string | null | undefined;
    private initialized = false;
    private disposed = false;
    private wakeReconcileTimer: ReturnType<typeof window.setTimeout> | null = null;
    private originalPushState: History['pushState'] | null = null;
    private originalReplaceState: History['replaceState'] | null = null;
    private wrappedPushState: History['pushState'] | null = null;
    private wrappedReplaceState: History['replaceState'] | null = null;
    private readonly handlePageShow = () => {
        this.scheduleWakeReconciliation();
    };
    private readonly handlePageResume = () => {
        this.scheduleWakeReconciliation();
    };
    private readonly handlePopState = () => {
        this.synchronizeCurrentEpoch(true);
    };
    private readonly handleHashChange = () => {
        this.synchronizeCurrentEpoch(false);
    };

    constructor(
        adapter: SiteAdapter,
        _options: ChatGPTConversationContentRuntimeOptions = {},
    ) {
        const pageEpochId = `runtime-${Date.now().toString(36)}-${++pageEpochSequence}`;
        this.pageDocument = Object.freeze({
            key: createConversationPageDocumentKeyV1('chatgpt', pageEpochId),
            platformId: 'chatgpt',
            identityKind: 'page' as const,
            conversationId: null,
            canonicalUrl: window.location.href,
        });
        this.graphAdapter = new ChatGPTConversationDiscoveryAdapter();
        this.repository = new ConversationContentRepository({
            resolveDocument: () => this.resolveCurrentDocument(),
            readBaseline: (_document, signal) => this.graphAdapter.readBaseline(signal),
        });
        this.pageIndex = getChatGPTPageIndex(adapter);
        this.hostMonitor = new ChatGPTConversationHostMonitor({
            adapter,
            index: this.pageIndex,
            repository: this.repository,
            resolveDocument: () => this.resolveCurrentDocument(),
            settleDelayMs: _options.hostSettleDelayMs,
        });
        this.surface = new ChatGPTConversationSurface({
            adapter,
            content: this.repository,
            pageIndex: this.pageIndex,
        });
        const source: ConversationDiscoveryContentPortV1 = {
            read: () => this.repository.read(),
            subscribe: (listener) => this.repository.subscribe(listener),
            refresh: () => this.refreshObservedContent(),
            isCurrent: (contentToken) => this.repository.isCurrent(contentToken),
            readTurn: (target) => this.repository.readTurn(target),
        };
        this.source = Object.freeze(source);
        this.materialization = this.surface;
    }

    get content(): ConversationDiscoveryContentPortV1 {
        return this.source;
    }

    /**
     * Explicit user-triggered retry of the passive baseline peek. Re-arms a
     * failed (open) gate and reads bridge memory again; never issues a
     * request and never reopens a gate that already accepted a Graph.
     */
    retryBaselineDiscovery(): Promise<ConversationContentStateV1> {
        this.repository.reopenBaselineGate();
        return this.repository.enterCurrentEpoch();
    }

    setNavigationPort(navigation: ConversationNavigationPortV1 | null): void {
        this.surface.setNavigationPort(navigation);
    }

    init(): void {
        if (this.initialized || this.disposed) return;
        this.initialized = true;
        // Subscribe route ownership before the Host Monitor so a PageIndex
        // batch fences the old epoch before the same batch dirties new turns.
        this.unsubscribePage = this.pageIndex.subscribeObservations((batch) => {
            this.synchronizeCurrentEpoch(false, batch.pageUrl);
        });
        this.hostMonitor.init();
        this.unsubscribeGraph = this.graphAdapter.subscribeSignals(() => {
            // A capture can race a pushState/replaceState commit. Identity is
            // synchronized first so the evidence reaches the correct gate.
            this.synchronizeCurrentEpoch(false);
            this.repository.notifyBaselineCaptured();
            this.refreshBridgeDiagnostics();
        });
        window.addEventListener('pageshow', this.handlePageShow);
        document.addEventListener('resume', this.handlePageResume);
        window.addEventListener('popstate', this.handlePopState);
        window.addEventListener('hashchange', this.handleHashChange);
        this.installHistoryHooks();
        this.synchronizeCurrentEpoch(true);
        this.refreshBridgeDiagnostics();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.initialized = false;
        if (this.wakeReconcileTimer !== null) {
            window.clearTimeout(this.wakeReconcileTimer);
            this.wakeReconcileTimer = null;
        }
        window.removeEventListener('pageshow', this.handlePageShow);
        document.removeEventListener('resume', this.handlePageResume);
        window.removeEventListener('popstate', this.handlePopState);
        window.removeEventListener('hashchange', this.handleHashChange);
        this.restoreHistoryHooks();
        this.unsubscribePage?.();
        this.unsubscribePage = null;
        this.unsubscribeGraph?.();
        this.unsubscribeGraph = null;
        this.surface.dispose();
        this.hostMonitor.dispose();
        this.pageIndex.dispose();
        this.repository.dispose();
        this.graphAdapter.dispose();
        this.lastDocumentKey = undefined;
    }

    private scheduleWakeReconciliation(): void {
        if (this.disposed || this.wakeReconcileTimer !== null) return;
        this.wakeReconcileTimer = window.setTimeout(() => {
            this.wakeReconcileTimer = null;
            if (this.disposed) return;

            this.hostMonitor.notifyPageShow();
            // BFCache restores and frozen-page resumes keep the page bridge
            // and its memory alive. A baseline peek that missed the capture
            // gets one bounded re-arm; an accepted Graph stays untouched.
            this.repository.reopenBaselineGate();
            this.synchronizeCurrentEpoch(true);
            this.surface.refreshSurface();
        }, PAGE_LIFECYCLE_WAKE_COALESCE_MS);
    }

    private synchronizeCurrentEpoch(force: boolean, pageUrl = window.location.href): void {
        const nextDocumentKey = this.resolveCurrentDocument(pageUrl).key;
        const changed = nextDocumentKey !== this.lastDocumentKey;
        const isInitialSynchronization = this.lastDocumentKey === undefined;
        if (changed) this.hostMonitor.notifyRouteChanged(isInitialSynchronization);
        this.lastDocumentKey = nextDocumentKey;
        if (changed || force) void this.repository.enterCurrentEpoch();
    }

    private resolveCurrentDocument(pageUrl = window.location.href): ConversationDocumentRefV1 {
        return this.graphAdapter.resolveDocument(pageUrl) ?? Object.freeze({
            ...this.pageDocument,
            canonicalUrl: pageUrl,
        });
    }

    private async refreshObservedContent() {
        await this.repository.refresh();
        await this.hostMonitor.flushObserved();
        return this.repository.read();
    }

    /**
     * Assemble the read-only discovery diagnostics snapshot. Producers push
     * facts; this is a pure read and never changes discovery behavior.
     */
    readDiscoveryDiagnostics(): DiscoveryDiagnosticsSnapshotV1 {
        this.diagnostics.setRepositoryFacts(this.repository.readDiagnosticsFacts());
        this.diagnostics.setHostMonitorFacts(this.hostMonitor.readDiagnosticsFacts());
        this.diagnostics.setBridgeDiagnostics(this.graphAdapter.getCachedBridgeDiagnostics());
        this.diagnostics.setBridgeUnavailable(this.graphAdapter.isBridgeUnavailable());
        this.diagnostics.setCaptureSignalCount(this.graphAdapter.getCaptureSignalCount());
        return this.diagnostics.snapshot();
    }

    /**
     * Pull the page bridge's own counters in the background. Throttled because
     * capture signals can arrive in bursts and each pull is a same-window
     * event round-trip; failure keeps the previous snapshot intact. A
     * page-identity document has no eligible conversation GETs, so no bridge
     * request is issued before a canonical identity exists.
     */
    private refreshBridgeDiagnostics(): void {
        const document = this.resolveCurrentDocument();
        if (!document || document.conversationId === null) return;
        const now = Date.now();
        if (now - this.lastBridgeDiagnosticsPullAt < 500) return;
        this.lastBridgeDiagnosticsPullAt = now;
        void this.graphAdapter.readBridgeDiagnostics().then((next) => {
            if (this.disposed) return;
            this.diagnostics.setBridgeDiagnostics(next);
        }).catch(() => {
            // Bridge counters are best-effort diagnostics; the snapshot keeps
            // whatever the last successful pull produced.
        });
    }

    private installHistoryHooks(): void {
        if (this.originalPushState || this.originalReplaceState) return;
        const runtime = this;
        this.originalPushState = window.history.pushState;
        this.originalReplaceState = window.history.replaceState;
        this.wrappedPushState = function pushState(
            this: History,
            data: unknown,
            unused: string,
            url?: string | URL | null,
        ): void {
            runtime.originalPushState!.call(this, data, unused, url);
            runtime.synchronizeCurrentEpoch(false);
        };
        this.wrappedReplaceState = function replaceState(
            this: History,
            data: unknown,
            unused: string,
            url?: string | URL | null,
        ): void {
            runtime.originalReplaceState!.call(this, data, unused, url);
            runtime.synchronizeCurrentEpoch(false);
        };
        window.history.pushState = this.wrappedPushState;
        window.history.replaceState = this.wrappedReplaceState;
    }

    private restoreHistoryHooks(): void {
        if (this.wrappedPushState && window.history.pushState === this.wrappedPushState && this.originalPushState) {
            window.history.pushState = this.originalPushState;
        }
        if (
            this.wrappedReplaceState
            && window.history.replaceState === this.wrappedReplaceState
            && this.originalReplaceState
        ) {
            window.history.replaceState = this.originalReplaceState;
        }
        this.originalPushState = null;
        this.originalReplaceState = null;
        this.wrappedPushState = null;
        this.wrappedReplaceState = null;
    }
}
