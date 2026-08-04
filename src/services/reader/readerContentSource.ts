import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatTurn } from '../export/saveMessagesTypes';
import {
    normalizeChatGPTReaderPageUrl,
} from './chatgptReaderItems';
import { normalizeChatGPTReaderMarkdown } from '../../drivers/content/chatgpt/normalizeReaderMarkdown';
import { collectReaderItems, type CollectReaderItemsResult } from './collectReaderItems';
import { resolveContent, type ReaderItem } from './types';
import type { ReaderAnnotationDocument } from '../../contracts/readerAnnotations';
import type {
    ConversationContentSourceV1,
    ConversationContentStateV1,
    ConversationSnapshotV1,
} from '../../contracts/conversationContent';
import type { ConversationMaterializationPortV1, ConversationTargetV1 } from '../../contracts/conversationMaterialization';

export type ReaderContentMetadataSource = 'chatgpt-snapshot' | 'chatgpt-content-v1' | 'dom';

export type ReaderContentSourceOptions = {
    conversationContentSource?: ConversationContentSourceV1 | null;
    /** DOM-only identity/materialization port used to resolve an initial item. */
    conversationMaterialization?: ConversationMaterializationPortV1 | null;
    pageUrl?: string;
};

export type ReaderContentSourceRevision = {
    routeEpoch: number;
    revision: number;
    conversationId: string;
    contentToken?: string;
};

export type ReaderContentSourceStatus = 'ready' | 'unavailable' | 'target-unresolved';

export type ReaderContentSourceResult = CollectReaderItemsResult & {
    metadataSource: ReaderContentMetadataSource;
    annotationDocument?: ReaderAnnotationDocument;
    sourceRevision?: ReaderContentSourceRevision;
    status?: ReaderContentSourceStatus;
    /** Canonical ChatGPT coverage; exports must only use complete snapshots. */
    coverage?: ConversationSnapshotV1['coverage'];
};

export type FreshReaderItemResult = {
    item: ReaderItem;
    sourceRevision?: ReaderContentSourceRevision;
};

function getFallbackStartElement(adapter: SiteAdapter, messageElement: HTMLElement | null): HTMLElement | null {
    return messageElement ?? adapter.getLastMessageElement();
}

function getConversationContentSource(
    options: ReaderContentSourceOptions,
): ConversationContentSourceV1 | null {
    return options.conversationContentSource ?? null;
}

function resolveConversationStartTarget(
    materialization: ConversationMaterializationPortV1 | null | undefined,
    messageElement: HTMLElement | null,
    snapshot?: ConversationSnapshotV1,
): { ok: true; target: ConversationTargetV1 | null } | { ok: false } {
    if (!messageElement) return { ok: true, target: null };
    const target = materialization?.resolveElement(messageElement) ?? null;
    if (target) return { ok: true, target };
    if (!snapshot) return { ok: false };

    // The semantic source may become ready a few milliseconds before the DOM
    // materialization index observes the same remount. The assistant message
    // id is already a typed host identity, so it is safe to resolve the
    // Reader start directly from the canonical snapshot instead of reporting
    // a false "content not found" result.
    const identityElement = messageElement.matches('[data-message-id]')
        ? messageElement
        : messageElement.closest<HTMLElement>('[data-message-id]');
    const assistantMessageId = identityElement?.getAttribute('data-message-id')?.trim() || null;
    const turnRoot = messageElement.closest<HTMLElement>('[data-turn-id]');
    const turnId = turnRoot?.getAttribute('data-turn-id')?.trim() || null;
    const matches = snapshot.turns.filter((turn) => assistantMessageId
        ? turn.identity.assistantMessageId === assistantMessageId
        : !turnId || turn.identity.turnId === turnId);
    if (matches.length !== 1) return { ok: false };
    const turn = matches[0]!;
    return {
        ok: true,
        target: {
            documentKey: snapshot.document.key,
            turnId: turn.identity.turnId,
            assistantMessageId: turn.identity.assistantMessageId,
            userMessageId: turn.identity.userMessageId,
        },
    };
}

function resolveConversationStartIndex(
    snapshot: ConversationSnapshotV1,
    target: ConversationTargetV1 | null,
): number {
    if (!target) return Math.max(0, snapshot.turns.length - 1);
    const matches = snapshot.turns
        .map((turn, index) => ({ turn, index }))
        .filter(({ turn }) => (
            turn.identity.turnId === target.turnId
            && turn.identity.assistantMessageId === target.assistantMessageId
            && (target.userMessageId === undefined || turn.identity.userMessageId === target.userMessageId)
        ));
    return matches.length === 1 ? matches[0]!.index : -1;
}

function buildConversationReaderContent(
    snapshot: ConversationSnapshotV1,
    pageUrl: string,
): { items: ReaderItem[]; annotationDocument: ReaderAnnotationDocument } {
    const normalizedUrl = normalizeChatGPTReaderPageUrl(pageUrl);
    return {
        items: snapshot.turns.map((turn) => ({
            id: `chatgpt-${turn.identity.assistantMessageId}`,
            userPrompt: turn.userText,
            content: normalizeChatGPTReaderMarkdown(turn.assistantMarkdown),
            meta: {
                platformId: snapshot.document.platformId,
                messageId: turn.identity.assistantMessageId,
                roundId: turn.identity.turnId,
                userMessageId: turn.identity.userMessageId,
                assistantMessageId: turn.identity.assistantMessageId,
                position: turn.ordinal,
                url: normalizedUrl,
                bookmarkable: true,
                bookmarked: false,
            },
        })),
        annotationDocument: {
            platform: 'chatgpt',
            conversationId: snapshot.document.conversationId,
            title: snapshot.document.title,
            lastKnownUrl: normalizedUrl,
        },
    };
}

function getConversationContentRevision(
    state: ConversationContentStateV1,
    snapshot: ConversationSnapshotV1,
): ReaderContentSourceRevision | undefined {
    if (state.snapshot !== snapshot || state.document?.key !== snapshot.document.key) return undefined;
    return {
        routeEpoch: 0,
        revision: 0,
        conversationId: snapshot.document.conversationId,
        contentToken: snapshot.contentToken,
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
        metadataSource: 'chatgpt-content-v1',
        status,
    };
    const clonedRevision = cloneSourceRevision(sourceRevision);
    if (clonedRevision) result.sourceRevision = clonedRevision;
    return result;
}

export function readCurrentReaderContentSourceRevision(
    source: ConversationContentSourceV1,
): ReaderContentSourceRevision | undefined {
    const state = source.read();
    const snapshot = state.snapshot;
    return snapshot ? getConversationContentRevision(state, snapshot) : undefined;
}

export function isReaderContentSourceRevisionCurrent(
    source: ConversationContentSourceV1 | null | undefined,
    expected: ReaderContentSourceRevision | undefined,
): boolean {
    if (!source || !expected) return false;
    const current = readCurrentReaderContentSourceRevision(source);
    return Boolean(
        current
        && current.conversationId === expected.conversationId
        && (!expected.contentToken || current.contentToken === expected.contentToken),
    );
}

function projectConversationContent(
    state: ConversationContentStateV1,
    snapshot: ConversationSnapshotV1,
    startTargetResolution: { ok: true; target: ConversationTargetV1 | null } | { ok: false },
    options: ReaderContentSourceOptions,
): ReaderContentSourceResult {
    const sourceRevision = getConversationContentRevision(state, snapshot);
    if (!sourceRevision) return createChatGPTEmptyResult('unavailable');
    if (!startTargetResolution.ok) {
        return createChatGPTEmptyResult('target-unresolved', sourceRevision);
    }
    const pageUrl = options.pageUrl ?? window.location.href;
    const content = buildConversationReaderContent(snapshot, pageUrl);
    const startIndex = resolveConversationStartIndex(snapshot, startTargetResolution.target);
    if (startIndex < 0) return createChatGPTEmptyResult('target-unresolved', sourceRevision);
    return {
        items: content.items.map((item) => cloneReaderItem(item, normalizeChatGPTReaderPageUrl(pageUrl))),
        startIndex,
        metadataSource: 'chatgpt-content-v1',
        coverage: snapshot.coverage,
        annotationDocument: {
            ...content.annotationDocument,
            lastKnownUrl: normalizeChatGPTReaderPageUrl(pageUrl),
        },
        sourceRevision: cloneSourceRevision(sourceRevision),
        status: 'ready',
    };
}

function readCurrentConversationContent(
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): ReaderContentSourceResult {
    const source = getConversationContentSource(options);
    const state = source?.read();
    const snapshot = state?.snapshot;
    if (!source || !state || !snapshot) return createChatGPTEmptyResult('unavailable');
    const startTargetResolution = resolveConversationStartTarget(
        options.conversationMaterialization,
        startMessageElement,
        snapshot,
    );
    return projectConversationContent(state, snapshot, startTargetResolution, options);
}

export function readCurrentReaderContent(
    adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): ReaderContentSourceResult {
    if (adapter.getPlatformId?.() === 'chatgpt') {
        return readCurrentConversationContent(startMessageElement, options);
    }
    return collectDomFallbackReaderContent(adapter, startMessageElement);
}

async function collectChatGPTSnapshotReaderContent(
    _adapter: SiteAdapter,
    startMessageElement: HTMLElement | null,
    options: ReaderContentSourceOptions,
): Promise<ReaderContentSourceResult> {
    const source = getConversationContentSource(options);
    if (!source) return createChatGPTEmptyResult('unavailable');

    const initialStartTarget = resolveConversationStartTarget(
        options.conversationMaterialization,
        startMessageElement,
    );

    try {
        const state = await source.refresh();
        const snapshot = state.snapshot;
        if (!snapshot) return createChatGPTEmptyResult('unavailable');

        let startTargetResolution = initialStartTarget;
        if (!startTargetResolution.ok && startMessageElement) {
            startTargetResolution = resolveConversationStartTarget(
                options.conversationMaterialization,
                startMessageElement,
                snapshot,
            );
        }

        return projectConversationContent(state, snapshot, startTargetResolution, options);
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
