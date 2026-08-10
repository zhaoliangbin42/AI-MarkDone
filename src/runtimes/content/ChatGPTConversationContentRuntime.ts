import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { ConversationDiscoveryContentPortV1 } from '../../contracts/conversationDiscovery';
import type { ConversationNavigationPortV1 } from '../../contracts/conversationNavigation';
import { ConversationContentRepository } from '../../services/content/ConversationContentRepository';
import { ChatGPTConversationDiscoveryAdapter } from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';
import { ChatGPTConversationDiscoveryCoordinator } from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator';
import { ChatGPTConversationMaterialization } from '../../drivers/content/chatgpt/ChatGPTConversationMaterialization';
import { ChatGPTConversationHostMonitor } from '../../drivers/content/chatgpt/ChatGPTConversationHostMonitor';
import { getChatGPTConversationIndex } from '../../drivers/content/chatgpt/ChatGPTConversationIndex';
import { getChatGPTPageIndex } from '../../drivers/content/chatgpt/domConversationDiscovery';

export type ChatGPTConversationContentRuntimeOptions = Readonly<{
    /** Test seam; production uses the 400ms stable-host quiet window. */
    hostSettleDelayMs?: number;
}>;

/**
 * ChatGPT composition root. The published content/materialization ports are
 * backed by one passive-baseline/stable-host-tail Repository and one shared
 * DOM materialization adapter. No consumer may introduce another content
 * observer, repository, or extraction path.
 *
 * The `source` and `materialization` fields are read-only projections.
 * The graph adapter only peeks at evidence captured from the website's own
 * conversation response. It never issues a conversation request.
 */
export class ChatGPTConversationContentRuntime {
    readonly source: ConversationDiscoveryContentPortV1;
    readonly materialization: ConversationMaterializationPortV1 & { dispose(): void };
    private readonly graphAdapter: ChatGPTConversationDiscoveryAdapter;
    private readonly repository: ConversationContentRepository;
    private readonly coordinator: ChatGPTConversationDiscoveryCoordinator;
    private readonly graphMaterialization: ChatGPTConversationMaterialization;
    private readonly hostMonitor: ChatGPTConversationHostMonitor;

    constructor(
        adapter: SiteAdapter,
        _options: ChatGPTConversationContentRuntimeOptions = {},
    ) {
        this.graphAdapter = new ChatGPTConversationDiscoveryAdapter();
        this.repository = new ConversationContentRepository({
            resolveDocument: () => this.graphAdapter.resolveDocument(),
            readBaseline: (_document, signal) => this.graphAdapter.readBaseline(signal),
        });
        const index = getChatGPTConversationIndex(adapter);
        const pageIndex = getChatGPTPageIndex(adapter);
        index.bindConversationSource(this.repository);
        this.hostMonitor = new ChatGPTConversationHostMonitor({
            adapter,
            index: pageIndex,
            repository: this.repository,
            resolveDocument: () => this.graphAdapter.resolveDocument(),
            settleDelayMs: _options.hostSettleDelayMs,
        });
        this.coordinator = new ChatGPTConversationDiscoveryCoordinator({
            adapter,
            discoveryAdapter: this.graphAdapter,
            repository: this.repository,
            hostMonitor: this.hostMonitor,
            pageIndex,
        });
        this.graphMaterialization = new ChatGPTConversationMaterialization({
            adapter,
            content: this.repository,
            index,
        });
        this.source = this.repository;
        this.materialization = this.graphMaterialization;
    }

    get content(): ConversationDiscoveryContentPortV1 {
        return this.source;
    }

    setNavigationPort(navigation: ConversationNavigationPortV1 | null): void {
        this.graphMaterialization.setNavigationPort(navigation);
    }

    init(): void {
        this.coordinator.init();
    }

    dispose(): void {
        this.graphMaterialization.dispose();
        this.coordinator.dispose();
        this.repository.dispose();
        this.graphAdapter.dispose();
    }
}
