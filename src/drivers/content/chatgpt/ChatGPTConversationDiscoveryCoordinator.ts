import type { ConversationContentStateV1 } from '../../../contracts/conversationContent';
import { RouteWatcher } from '../injection/routeWatcher';
import { getChatGPTPageIndex } from './domConversationDiscovery';
import type { ChatGPTPageIndex } from './ChatGPTPageIndex';
import type { ChatGPTConversationDiscoveryAdapter } from './ChatGPTConversationDiscoveryAdapter';
import type { ChatGPTConversationHostMonitor } from './ChatGPTConversationHostMonitor';
import type { SiteAdapter } from '../adapters/base';

export type ChatGPTConversationDiscoveryCoordinatorOptions = Readonly<{
    adapter: SiteAdapter;
    discoveryAdapter: ChatGPTConversationDiscoveryAdapter;
    repository: ConversationContentSessionLifecycle;
    hostMonitor?: ChatGPTConversationHostMonitor;
    pageIndex?: ChatGPTPageIndex;
}>;

type ConversationContentSessionLifecycle = Readonly<{
    enterCurrentEpoch(): Promise<ConversationContentStateV1>;
    notifyBaselineCaptured(): void;
}>;

/**
 * Owns route/page/bridge lifecycle signals. Host DOM observations go directly
 * through the shared PageIndex-backed Host Monitor and never replay baseline
 * admission.
 */
export class ChatGPTConversationDiscoveryCoordinator {
    private readonly pageIndex: ChatGPTPageIndex;
    private readonly routeWatcher: RouteWatcher;
    private unsubscribeAdapter: (() => void) | null = null;
    private readonly handlePageShow = () => {
        this.options.discoveryAdapter.notifyLifecycleSignal?.();
        this.options.hostMonitor?.notifyPageShow();
        this.enterCurrentEpoch();
    };
    private initialized = false;

    constructor(private readonly options: ChatGPTConversationDiscoveryCoordinatorOptions) {
        this.pageIndex = options.pageIndex ?? getChatGPTPageIndex(options.adapter);
        this.routeWatcher = new RouteWatcher(
            () => {
                this.options.discoveryAdapter.notifyLifecycleSignal?.();
                this.options.hostMonitor?.notifyRouteChanged();
                this.enterCurrentEpoch();
            },
            { intervalMs: 500 },
        );
    }

    init(): void {
        if (this.initialized || this.options.adapter.getPlatformId() !== 'chatgpt') return;
        this.initialized = true;
        this.options.hostMonitor?.init();
        this.unsubscribeAdapter = this.options.discoveryAdapter.subscribeSignals(() => {
            this.options.repository.notifyBaselineCaptured();
        });
        window.addEventListener('pageshow', this.handlePageShow);
        this.routeWatcher.start();
        void this.options.repository.enterCurrentEpoch();
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        this.routeWatcher.stop();
        this.options.hostMonitor?.dispose();
        this.unsubscribeAdapter?.();
        this.unsubscribeAdapter = null;
        window.removeEventListener('pageshow', this.handlePageShow);
        this.pageIndex.dispose();
    }

    private enterCurrentEpoch(): void {
        void this.options.repository.enterCurrentEpoch();
    }

}
