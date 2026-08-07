import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { ConversationDiscoveryContentPortV1 } from '../../contracts/conversationDiscovery';
import type { ConversationNavigationPortV1 } from '../../contracts/conversationNavigation';
import { ConversationContentRepository } from '../../services/content/ConversationContentRepository';
import { ChatGPTConversationDiscoveryAdapter } from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';
import { ChatGPTConversationDiscoveryCoordinator } from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator';
import { ChatGPTConversationMaterialization } from '../../drivers/content/chatgpt/ChatGPTConversationMaterialization';
import { getChatGPTConversationIndex } from '../../drivers/content/chatgpt/ChatGPTConversationIndex';

export type ChatGPTConversationContentRuntimeOptions = Readonly<{
    /** Kept for constructor compatibility; V2 never performs network acquisition. */
    allowActiveAcquisition?: boolean;
}>;

/**
 * ChatGPT composition root. The published content/materialization ports are
 * backed by one passive graph Repository and one DOM materialization adapter.
 * No consumer is allowed to introduce a second DOM-derived content source.
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

    constructor(
        adapter: SiteAdapter,
        _options: ChatGPTConversationContentRuntimeOptions = {},
    ) {
        this.graphAdapter = new ChatGPTConversationDiscoveryAdapter(_options);
        this.repository = new ConversationContentRepository({
            resolveDocument: () => this.graphAdapter.resolveDocument(),
            acquire: (_document, signal) => this.graphAdapter.acquire(signal),
        });
        const index = getChatGPTConversationIndex(adapter);
        index.bindConversationSource(this.repository);
        this.coordinator = new ChatGPTConversationDiscoveryCoordinator({
            adapter,
            discoveryAdapter: this.graphAdapter,
            repository: this.repository,
            pageIndex: undefined,
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
