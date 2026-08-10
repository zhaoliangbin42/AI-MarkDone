import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import type {
    ConversationContentSourceV1,
    ConversationContentStateV1,
} from '../../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import {
    readCurrentReaderContent,
} from '../../../services/reader/readerContentSource';
import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderPanelPort } from '../reader/ReaderPanelPort';

type ReaderUpdatePlan =
    | { kind: 'none' }
    | { kind: 'append'; items: ReaderItem[] }
    | { kind: 'replace'; items: ReaderItem[] };

type ChatGPTConversationReaderBindingOptions = {
    adapter: SiteAdapter;
    source: ConversationContentSourceV1;
    materialization?: ConversationMaterializationPortV1 | null;
    readerPanel: ReaderPanelPort;
    pageUrl: () => string;
    prepareItems?: (items: ReaderItem[]) => void;
};

function normalizedIdentity(item: ReaderItem): string {
    const meta = item.meta ?? {};
    return [
        meta.position,
        meta.roundId,
        meta.userMessageId,
        meta.assistantMessageId,
        meta.messageId,
    ].map((value) => String(value ?? '')).join('\u0000');
}

function hasSameCanonicalContent(left: ReaderItem, right: ReaderItem): boolean {
    return left.id === right.id
        && normalizedIdentity(left) === normalizedIdentity(right)
        && left.userPrompt === right.userPrompt
        && typeof left.content === 'string'
        && typeof right.content === 'string'
        && left.content === right.content;
}

function planChatGPTReaderUpdate(
    currentItems: ReaderItem[],
    nextItems: ReaderItem[],
): ReaderUpdatePlan {
    if (
        currentItems.length === nextItems.length
        && currentItems.every((item, index) => hasSameCanonicalContent(item, nextItems[index]!))
    ) {
        return { kind: 'none' };
    }
    if (
        currentItems.length > 0
        && currentItems.length < nextItems.length
        && currentItems.every((item, index) => hasSameCanonicalContent(item, nextItems[index]!))
    ) {
        return { kind: 'append', items: nextItems.slice(currentItems.length) };
    }
    return { kind: 'replace', items: nextItems };
}

export class ChatGPTConversationReaderBinding {
    private unsubscribe: (() => void) | null = null;
    private applyVersion = 0;

    constructor(private readonly options: ChatGPTConversationReaderBindingOptions) {}

    init(): void {
        if (this.unsubscribe) return;
        this.unsubscribe = this.options.source.subscribe((state) => this.handleState(state));
    }

    dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.applyVersion += 1;
        if (this.options.readerPanel.isShowingConversationReader()) {
            this.options.readerPanel.hide();
        }
    }

    private handleState(state: ConversationContentStateV1): void {
        const version = ++this.applyVersion;
        if (!this.options.readerPanel.isShowingConversationReader()) return;
        if (!state.snapshot) {
            this.options.readerPanel.hide();
            return;
        }

        const result = readCurrentReaderContent(this.options.adapter, null, {
            conversationContentSource: this.options.source,
            conversationMaterialization: this.options.materialization,
            pageUrl: this.options.pageUrl(),
        });
        const items = [...result.items];
        this.options.prepareItems?.(items);
        void this.applyState(version, state, items);
    }

    private isCurrent(version: number, state: ConversationContentStateV1): boolean {
        const current = this.options.source.read();
        return version === this.applyVersion
            && this.options.readerPanel.isShowingConversationReader()
            && current.document?.key === state.document?.key
            && current.snapshot?.contentToken === state.snapshot?.contentToken;
    }

    private async applyState(
        version: number,
        state: ConversationContentStateV1,
        nextItems: ReaderItem[],
    ): Promise<void> {
        if (!this.isCurrent(version, state)) return;
        const plan = planChatGPTReaderUpdate(
            this.options.readerPanel.getItemsSnapshot(),
            nextItems,
        );
        if (plan.kind === 'none') return;
        if (plan.kind === 'replace') {
            await this.options.readerPanel.replaceItems(plan.items, {
                preserveCurrentIdentity: true,
            });
            return;
        }
        for (const item of plan.items) {
            if (!this.isCurrent(version, state)) return;
            await this.options.readerPanel.appendItem(item);
        }
    }
}
