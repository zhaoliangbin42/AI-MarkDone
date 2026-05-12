import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatGPTConversationEngine } from '../../drivers/content/chatgpt/ChatGPTConversationEngine';
import type { ChatTurn } from '../export/saveMessagesTypes';
import { buildChatGPTReaderItems } from './chatgptReaderItems';
import { collectReaderItems, type CollectReaderItemsResult } from './collectReaderItems';
import { resolveContent, type ReaderItem } from './types';

export type ReaderContentMetadataSource = 'chatgpt-snapshot' | 'dom';

export type ReaderContentSourceOptions = {
    chatGptConversationEngine?: ChatGPTConversationEngine | null;
    pageUrl?: string;
};

export type ReaderContentSourceResult = CollectReaderItemsResult & {
    metadataSource: ReaderContentMetadataSource;
};

function getStartTarget(adapter: SiteAdapter, messageElement: HTMLElement | null) {
    if (!messageElement) return null;
    return {
        messageId: adapter.getMessageId(messageElement),
        userPrompt: adapter.extractUserPrompt(messageElement),
    };
}

function getFallbackStartElement(adapter: SiteAdapter, messageElement: HTMLElement | null): HTMLElement | null {
    return messageElement ?? adapter.getLastMessageElement();
}

async function collectChatGPTSnapshotReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult | null> {
    if (adapter.getPlatformId?.() !== 'chatgpt' || !options.chatGptConversationEngine) return null;

    try {
        const snapshot = await options.chatGptConversationEngine.getSnapshot();
        if (!snapshot?.rounds?.length) return null;
        const result = buildChatGPTReaderItems(
            snapshot,
            getStartTarget(adapter, startMessageElement),
            options.pageUrl ?? window.location.href,
        );
        return { ...result, metadataSource: 'chatgpt-snapshot' };
    } catch {
        return null;
    }
}

function collectDomFallbackReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
): ReaderContentSourceResult {
    const fallbackStart = getFallbackStartElement(adapter, startMessageElement);
    if (!fallbackStart) return { items: [], startIndex: 0, metadataSource: 'dom' };

    return {
        ...collectReaderItems(adapter, fallbackStart),
        metadataSource: 'dom',
    };
}

export async function collectReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options?: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult> {
    const chatGptSnapshotContent = options
        ? await collectChatGPTSnapshotReaderContent(adapter, startMessageElement, options)
        : null;
    return chatGptSnapshotContent ?? collectDomFallbackReaderContent(adapter, startMessageElement);
}

export async function readerItemsToChatTurns(items: ReaderItem[]): Promise<ChatTurn[]> {
    const turns: ChatTurn[] = [];
    for (const [index, item] of items.entries()) {
        let assistant = '';
        try {
            assistant = await resolveContent(item.content);
        } catch {
            assistant = '';
        }
        turns.push({
            user: item.userPrompt,
            assistant,
            index,
        });
    }
    return turns;
}
