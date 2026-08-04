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
    buildChatGPTReaderContent,
    normalizeChatGPTReaderPageUrl,
    resolveChatGPTReaderStartIndex,
    type ChatGPTConversationStartTarget,
} from './chatgptReaderItems';
import { collectReaderItems, type CollectReaderItemsResult } from './collectReaderItems';
import { resolveContent, type ReaderItem } from './types';
import type { ReaderAnnotationDocument } from '../../contracts/readerAnnotations';

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

export type ReaderContentSourceStatus = 'ready' | 'unavailable' | 'target-unresolved';

export type ReaderContentSourceResult = CollectReaderItemsResult & {
    metadataSource: ReaderContentMetadataSource;
    annotationDocument?: ReaderAnnotationDocument;
    sourceRevision?: ReaderContentSourceRevision;
    status?: ReaderContentSourceStatus;
};

export type FreshReaderItemResult = {
    item: ReaderItem;
    sourceRevision?: ReaderContentSourceRevision;
};

type ChatGptStartTargetResolution =
    | { ok: true; target: ChatGPTConversationStartTarget | null }
    | { ok: false };

type CachedChatGPTReaderContent = {
    items: ReaderItem[];
    annotationDocument: ReaderAnnotationDocument;
};

const chatGPTReaderContentCache = new WeakMap<
    ChatGPTConversationSnapshot,
    CachedChatGPTReaderContent
>();

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

function cloneSourceRevision(
    revision: ReaderContentSourceRevision | undefined,
): ReaderContentSourceRevision | undefined {
    return revision ? { ...revision } : undefined;
}

function cloneReaderItem(item: ReaderItem, pageUrl: string): ReaderItem {
    return {
        ...item,
        meta: item.meta ? { ...item.meta, url: pageUrl } : undefined,
    };
}

function createChatGPTEmptyResult(
    status: ReaderContentSourceStatus,
    sourceRevision?: ReaderContentSourceRevision,
): ReaderContentSourceResult {
    const result: ReaderContentSourceResult = {
        items: [],
        startIndex: 0,
        metadataSource: 'chatgpt-snapshot',
        status,
    };
    const clonedRevision = cloneSourceRevision(sourceRevision);
    if (clonedRevision) result.sourceRevision = clonedRevision;
    return result;
}

function getOrCreateChatGPTReaderContent(
    snapshot: ChatGPTConversationSnapshot,
    pageUrl: string,
): CachedChatGPTReaderContent {
    const cached = chatGPTReaderContentCache.get(snapshot);
    if (cached) return cached;

    const next = buildChatGPTReaderContent(snapshot, pageUrl);
    chatGPTReaderContentCache.set(snapshot, next);
    return next;
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
    snapshot: ChatGPTConversationSnapshot,
    state: ChatGPTConversationState,
    startTargetResolution: ChatGptStartTargetResolution,
    options: ReaderContentSourceOptions,
): ReaderContentSourceResult {
    const sourceRevision = getSourceRevision(state, snapshot);
    if (!snapshot.rounds.length) return createChatGPTEmptyResult('unavailable', sourceRevision);
    if (!sourceRevision) return createChatGPTEmptyResult('unavailable');
    if (!startTargetResolution.ok) {
        return createChatGPTEmptyResult('target-unresolved', sourceRevision);
    }

    const pageUrl = options.pageUrl ?? window.location.href;
    const normalizedPageUrl = normalizeChatGPTReaderPageUrl(pageUrl);
    const cached = getOrCreateChatGPTReaderContent(snapshot, pageUrl);

    const startIndex = resolveChatGPTReaderStartIndex(snapshot, startTargetResolution.target);
    if (startIndex < 0) {
        return createChatGPTEmptyResult('target-unresolved', sourceRevision);
    }

    return {
        items: cached.items.map((item) => cloneReaderItem(
            item,
            normalizedPageUrl,
        )),
        startIndex,
        metadataSource: 'chatgpt-snapshot',
        annotationDocument: {
            ...cached.annotationDocument,
            lastKnownUrl: normalizedPageUrl,
        },
        sourceRevision: cloneSourceRevision(sourceRevision),
        status: 'ready',
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
        if (!source || !state || !snapshot) {
            return createChatGPTEmptyResult('unavailable');
        }

        const startTargetResolution = resolveChatGptStartTarget(adapter, startMessageElement);
        return projectChatGPTSnapshotReaderContent(
            snapshot,
            state,
            startTargetResolution,
            options,
        );
    }
    return collectDomFallbackReaderContent(adapter, startMessageElement);
}

async function collectChatGPTSnapshotReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult> {
    const source = getChatGptConversationSource(options);
    if (!source) return createChatGPTEmptyResult('unavailable');

    const initialStartTarget = resolveChatGptStartTarget(adapter, startMessageElement);

    try {
        await source.ensureReady();
        const state = source.getState();
        const snapshot = state.snapshot;
        if (!snapshot) return createChatGPTEmptyResult('unavailable');

        let startTargetResolution = initialStartTarget;
        if (!startTargetResolution.ok && startMessageElement) {
            startTargetResolution = resolveChatGptStartTarget(adapter, startMessageElement);
        }

        return projectChatGPTSnapshotReaderContent(
            snapshot,
            state,
            startTargetResolution,
            options,
        );
    } catch {
        return createChatGPTEmptyResult('unavailable');
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
    if (adapter.getPlatformId?.() !== 'chatgpt') {
        return collectDomFallbackReaderContent(adapter, startMessageElement);
    }
    return collectChatGPTSnapshotReaderContent(adapter, startMessageElement, options);
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
