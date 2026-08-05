import type {
    ConversationContentCoordinatorV1,
} from '../../../contracts/conversationContent';
import { RouteWatcher } from '../injection/routeWatcher';
import { getChatGPTPageIndex } from './domConversationDiscovery';
import type { ChatGPTPageIndex } from './ChatGPTPageIndex';
import type { ChatGPTConversationDiscoveryAdapter } from './ChatGPTConversationDiscoveryAdapter';
import type { SiteAdapter } from '../adapters/base';

export type ChatGPTConversationDiscoveryCoordinatorOptions = Readonly<{
    adapter: SiteAdapter;
    discoveryAdapter: ChatGPTConversationDiscoveryAdapter;
    repository: ConversationContentCoordinatorV1;
    pageIndex?: ChatGPTPageIndex;
}>;

/**
 * Owns discovery signals. None of the signal handlers collect content; they
 * only enter the repository's one reconcile path.
 */
export class ChatGPTConversationDiscoveryCoordinator {
    private readonly pageIndex: ChatGPTPageIndex;
    private readonly routeWatcher: RouteWatcher;
    private unsubscribePageIndex: (() => void) | null = null;
    private unsubscribeAdapter: (() => void) | null = null;
    private readonly handlePageShow = () => {
        this.requestImmediateReconcile();
    };
    private initialized = false;

    constructor(private readonly options: ChatGPTConversationDiscoveryCoordinatorOptions) {
        this.pageIndex = options.pageIndex ?? getChatGPTPageIndex(options.adapter);
        this.routeWatcher = new RouteWatcher(
            () => {
                this.requestImmediateReconcile();
            },
            { intervalMs: 500 },
        );
    }

    init(): void {
        if (this.initialized || this.options.adapter.getPlatformId() !== 'chatgpt') return;
        this.initialized = true;
        this.unsubscribePageIndex = this.pageIndex.subscribeMutations(() => {
            this.options.repository.scheduleReconcile();
        });
        this.unsubscribeAdapter = this.options.discoveryAdapter.subscribeSignals(() => {
            this.options.repository.scheduleReconcile();
        });
        window.addEventListener('pageshow', this.handlePageShow);
        this.routeWatcher.start();
        void this.options.repository.reconcile();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        this.routeWatcher.stop();
        this.unsubscribePageIndex?.();
        this.unsubscribePageIndex = null;
        this.unsubscribeAdapter?.();
        this.unsubscribeAdapter = null;
        window.removeEventListener('pageshow', this.handlePageShow);
        this.pageIndex.dispose();
    }

    private requestImmediateReconcile(): void {
        // Route/pageshow are immediate when idle, but a page lifecycle signal
        // during an active acquisition must become the repository's one
        // pending reconcile rather than being dropped by single-flight.
        if (this.options.repository.read().kind === 'syncing') {
            this.options.repository.scheduleReconcile();
            return;
        }
        void this.options.repository.reconcile();
    }
}
