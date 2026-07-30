import type { SiteAdapter } from '../../drivers/content/adapters/base';
import {
    getChatGPTConversationIndex,
    type ChatGPTIndexedRound,
} from '../../drivers/content/chatgpt/ChatGPTConversationIndex';
import type {
    ChatGPTConversationSnapshot,
    ChatGPTConversationSource,
    ChatGPTConversationState,
} from '../../drivers/content/chatgpt/types';
import type { ChatTurn } from '../export/saveMessagesTypes';
import {
    buildChatGPTReaderItems,
    type ChatGPTConversationStartTarget,
} from './chatgptReaderItems';
import { collectReaderItems, type CollectReaderItemsResult } from './collectReaderItems';
import { resolveContent, type ReaderItem } from './types';

export type ReaderContentMetadataSource = 'chatgpt-snapshot' | 'dom';

export type ReaderContentSourceOptions = {
    chatGptConversationSource?: ChatGPTConversationSource | null;
    pageUrl?: string;
};

export type ReaderContentSourceRevision = {
    routeEpoch: number;
    revision: number;
    conversationId: string;
};

export type ReaderContentSourceResult = CollectReaderItemsResult & {
    metadataSource: ReaderContentMetadataSource;
    sourceRevision?: ReaderContentSourceRevision;
};

export type FreshReaderItemResult = {
    item: ReaderItem;
    sourceRevision?: ReaderContentSourceRevision;
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
    messageElement: HTMLElement | null,
): ChatGptStartTargetResolution {
    if (!messageElement) return { ok: true, target: null };
    const index = getChatGPTConversationIndex(adapter);
    const indexedRound = index.resolveRoundForElement(messageElement);
    return indexedRound
        ? { ok: true, target: toChatGptStartTarget(indexedRound) }
        : { ok: false };
}

function getFallbackStartElement(adapter: SiteAdapter, messageElement: HTMLElement | null): HTMLElement | null {
    return messageElement ?? adapter.getLastMessageElement();
}

function getChatGptConversationSource(
    options: ReaderContentSourceOptions,
): ChatGPTConversationSource | null {
    return options.chatGptConversationSource ?? null;
}

function getSourceRevision(
    state: ChatGPTConversationState,
    snapshot: ChatGPTConversationSnapshot,
): ReaderContentSourceRevision | undefined {
    if (
        state.snapshot !== snapshot
        || state.conversationId !== snapshot.conversationId
    ) {
        return undefined;
    }
    return {
        routeEpoch: state.routeEpoch,
        revision: state.revision,
        conversationId: snapshot.conversationId,
    };
}

export function readCurrentReaderContentSourceRevision(
    source: ChatGPTConversationSource,
): ReaderContentSourceRevision | undefined {
    const state = source.getState();
    const snapshot = state.snapshot;
    return snapshot ? getSourceRevision(state, snapshot) : undefined;
}

export function isReaderContentSourceRevisionCurrent(
    source: ChatGPTConversationSource | null | undefined,
    expected: ReaderContentSourceRevision | undefined,
): boolean {
    if (!source || !expected) return false;
    const current = readCurrentReaderContentSourceRevision(source);
    return Boolean(
        current
        && current.routeEpoch === expected.routeEpoch
        && current.revision === expected.revision
        && current.conversationId === expected.conversationId
    );
}

function projectChatGPTSnapshotReaderContent(
    adapter: SiteAdapter,
    snapshot: ChatGPTConversationSnapshot,
    state: ChatGPTConversationState,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): ReaderContentSourceResult | null {
    if (!snapshot.rounds.length) return null;
    const startTarget = resolveChatGptStartTarget(adapter, startMessageElement);
    if (!startTarget.ok) {
        return {
            items: [],
            startIndex: 0,
            metadataSource: 'chatgpt-snapshot',
            sourceRevision: getSourceRevision(state, snapshot),
        };
    }
    const result = buildChatGPTReaderItems(
        snapshot,
        startTarget.target,
        options.pageUrl ?? window.location.href,
    );
    return {
        ...result,
        metadataSource: 'chatgpt-snapshot',
        sourceRevision: getSourceRevision(state, snapshot),
    };
}

export function readCurrentReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): ReaderContentSourceResult {
    if (adapter.getPlatformId?.() === 'chatgpt') {
        const source = getChatGptConversationSource(options);
        const state = source?.getState();
        const snapshot = state?.snapshot;
        if (!state || !snapshot) {
            return { items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' };
        }
        return projectChatGPTSnapshotReaderContent(
            adapter,
            snapshot,
            state,
            startMessageElement,
            options,
        ) ?? { items: [], startIndex: 0, metadataSource: 'chatgpt-snapshot' };
    }
    return collectDomFallbackReaderContent(adapter, startMessageElement);
}

async function collectChatGPTSnapshotReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult | null> {
    const source = getChatGptConversationSource(options);
    if (adapter.getPlatformId?.() !== 'chatgpt' || !source) return null;

    try {
        await source.ensureReady();
        const state = source.getState();
        const snapshot = state.snapshot;
        if (!snapshot?.rounds?.length) return null;
        return projectChatGPTSnapshotReaderContent(
            adapter,
            snapshot,
            state,
            startMessageElement,
            options,
        );
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

export async function collectFreshReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult> {
    const chatGptSnapshotContent = await collectChatGPTSnapshotReaderContent(
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
): Promise<FreshReaderItemResult | null> {
    const result = await collectFreshReaderContent(adapter, messageElement, options);
    const item = result.items[result.startIndex];
    return item
        ? { item, sourceRevision: result.sourceRevision }
        : null;
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
