import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatGPTConversationEngine } from '../../drivers/content/chatgpt/ChatGPTConversationEngine';
import {
    getChatGPTConversationIndex,
    type ChatGPTIndexedRound,
} from '../../drivers/content/chatgpt/ChatGPTConversationIndex';
import type { ChatGPTConversationStartTarget } from '../../drivers/content/chatgpt/chatgptConversationSource';
import type { ChatGPTConversationSnapshot } from '../../drivers/content/chatgpt/types';
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

type ChatGptStartTargetResolution =
    | { ok: true; target: ChatGPTConversationStartTarget | null }
    | { ok: false };

function toChatGptStartTarget(indexedRound: ChatGPTIndexedRound): ChatGPTConversationStartTarget {
    return {
        position: indexedRound.position,
        positionSource: 'snapshot',
        messageId: indexedRound.round.messageId,
        roundId: indexedRound.identity.roundId,
        userMessageId: indexedRound.identity.userMessageId,
        assistantMessageId: indexedRound.identity.assistantMessageId,
    };
}

function resolveChatGptStartTarget(
    adapter: SiteAdapter,
    snapshot: ChatGPTConversationSnapshot,
    messageElement: HTMLElement | null,
): ChatGptStartTargetResolution {
    const index = getChatGPTConversationIndex(adapter);
    index.setSnapshot(snapshot);
    if (!messageElement) return { ok: true, target: null };
    const indexedRound = index.resolveRoundForElement(messageElement);
    return indexedRound
        ? { ok: true, target: toChatGptStartTarget(indexedRound) }
        : { ok: false };
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
        const startTarget = resolveChatGptStartTarget(adapter, snapshot, startMessageElement);
        if (!startTarget.ok) return { items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' };
        const result = buildChatGPTReaderItems(
            snapshot,
            startTarget.target,
            options.pageUrl ?? window.location.href,
        );
        return { ...result, metadataSource: 'chatgpt-snapshot' };
    } catch {
        return null;
    }
}

async function collectFreshChatGPTSnapshotReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult | null> {
    if (adapter.getPlatformId?.() !== 'chatgpt' || !options.chatGptConversationEngine) return null;

    try {
        const snapshot = await options.chatGptConversationEngine.forceRefreshCurrentConversation();
        if (!snapshot?.rounds?.length) return null;
        const startTarget = resolveChatGptStartTarget(adapter, snapshot, startMessageElement);
        if (!startTarget.ok) return { items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' };
        const result = buildChatGPTReaderItems(
            snapshot,
            startTarget.target,
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
    if (adapter.getPlatformId?.() === 'chatgpt') {
        return chatGptSnapshotContent ?? { items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' };
    }
    return chatGptSnapshotContent ?? collectDomFallbackReaderContent(adapter, startMessageElement);
}

export async function collectFreshReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult> {
    const chatGptSnapshotContent = await collectFreshChatGPTSnapshotReaderContent(
        adapter,
        startMessageElement,
        options,
    );
    if (adapter.getPlatformId?.() === 'chatgpt') {
        return chatGptSnapshotContent ?? { items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' };
    }
    return chatGptSnapshotContent ?? collectDomFallbackReaderContent(adapter, startMessageElement);
}

export async function collectFreshCurrentReaderItem(
    adapter: SiteAdapter,
    messageElement: HTMLElement,
    options: ReaderContentSourceOptions,
): Promise<ReaderItem | null> {
    if (adapter.getPlatformId?.() === 'chatgpt') {
        if (!options.chatGptConversationEngine) return null;
        const snapshot = await options.chatGptConversationEngine.forceRefreshCurrentConversation().catch(() => null);
        if (!snapshot?.rounds?.length) return null;
        const startTarget = resolveChatGptStartTarget(adapter, snapshot, messageElement);
        if (!startTarget.ok || !startTarget.target) return null;
        const result = buildChatGPTReaderItems(snapshot, startTarget.target, options.pageUrl ?? window.location.href);
        return result.items[result.startIndex] ?? null;
    }

    const result = await collectFreshReaderContent(adapter, messageElement, options);
    return result.items[result.startIndex] ?? null;
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
