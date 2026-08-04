import type { ConversationContentSourceV1 } from '../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { ChatGPTDomTurnFactSource } from '../../services/content/ChatGPTDomTurnFactSource';
import { ConversationContentRepository } from '../../services/content/ConversationContentRepository';
import {
    ChatGPTConversationDiscoveryAdapter,
    createChatGPTPartialCandidateFromDomObservation,
} from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryAdapter';
import { ChatGPTConversationDiscoveryCoordinator } from '../../drivers/content/chatgpt/ChatGPTConversationDiscoveryCoordinator';
import { ChatGPTConversationMaterialization } from '../../drivers/content/chatgpt/ChatGPTConversationMaterialization';

export type ChatGPTConversationContentRuntimeOptions = Readonly<{
    /** Active acquisition stays off until the real-browser gate is green. */
    allowActiveAcquisition?: boolean;
    domFacts?: ChatGPTDomTurnFactSource;
}>;

/**
 * Wires the V1 semantic source for one content-runtime page. The returned
 * source is the only discovery input that downstream consumers should use;
 * DOM facts are supplied to the adapter as typed evidence only.
 */
export class ChatGPTConversationContentRuntime {
    readonly domFacts: ChatGPTDomTurnFactSource;
    readonly discoveryAdapter: ChatGPTConversationDiscoveryAdapter;
    readonly repository: ConversationContentRepository;
    readonly coordinator: ChatGPTConversationDiscoveryCoordinator;
    readonly source: ConversationContentSourceV1;
    readonly materialization: ConversationMaterializationPortV1 & { dispose(): void };
    private readonly materializationFactory: () => ChatGPTConversationMaterialization;

    constructor(
        adapter: SiteAdapter,
        options: ChatGPTConversationContentRuntimeOptions = {},
    ) {
        this.domFacts = options.domFacts ?? new ChatGPTDomTurnFactSource(adapter);
        this.discoveryAdapter = new ChatGPTConversationDiscoveryAdapter({
            allowActiveAcquisition: options.allowActiveAcquisition === true,
            readTypedDomCandidate: () => {
                const document = this.discoveryAdapter.resolveDocument();
                if (!document) return null;
                return createChatGPTPartialCandidateFromDomObservation(
                    document,
                    this.domFacts.read(),
                );
            },
            hasTypedDomEvidence: () => {
                const document = this.discoveryAdapter.resolveDocument();
                return Boolean(document && createChatGPTPartialCandidateFromDomObservation(
                    document,
                    this.domFacts.read(),
                ));
            },
        });
        this.repository = new ConversationContentRepository({
            resolveDocument: () => this.discoveryAdapter.resolveDocument(),
            acquire: (_document, signal) => this.discoveryAdapter.acquire(signal),
        });
        this.source = this.repository;
        this.materializationFactory = () => new ChatGPTConversationMaterialization({
            adapter,
            content: this.repository,
        });
        this.materialization = new LazyConversationMaterialization(this.materializationFactory);
        this.coordinator = new ChatGPTConversationDiscoveryCoordinator({
            adapter,
            discoveryAdapter: this.discoveryAdapter,
            repository: this.repository,
        });
    }

    init(): void {
        this.repository.resume();
        this.coordinator.init();
    }

    dispose(): void {
        this.materialization.dispose();
        this.coordinator.dispose();
        this.discoveryAdapter.dispose();
        this.repository.dispose();
    }
}

/** Avoids touching the shared DOM index while a platform runtime is disabled. */
class LazyConversationMaterialization implements ConversationMaterializationPortV1 {
    private inner: ChatGPTConversationMaterialization | null = null;

    constructor(private readonly factory: () => ChatGPTConversationMaterialization) {}

    read(): ReturnType<ConversationMaterializationPortV1['read']> {
        return this.get().read();
    }

    subscribe(listener: Parameters<ConversationMaterializationPortV1['subscribe']>[0]): () => void {
        return this.get().subscribe(listener);
    }

    resolveElement(element: HTMLElement): ReturnType<ConversationMaterializationPortV1['resolveElement']> {
        return this.get().resolveElement(element);
    }

    locate(
        target: Parameters<ConversationMaterializationPortV1['locate']>[0],
        signal?: AbortSignal,
    ): ReturnType<ConversationMaterializationPortV1['locate']> {
        return this.get().locate(target, signal);
    }

    dispose(): void {
        this.inner?.dispose();
        this.inner = null;
    }

    private get(): ChatGPTConversationMaterialization {
        return this.inner ??= this.factory();
    }
}
