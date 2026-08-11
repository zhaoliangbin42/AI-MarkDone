import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatTurn } from '../export/saveMessagesTypes';
import {
    normalizeChatGPTReaderPageUrl,
} from './chatgptReaderItems';
import { collectReaderItems, type CollectReaderItemsResult } from './collectReaderItems';
import { resolveContent, type ReaderItem } from './types';
import type { ReaderAnnotationDocument } from '../../contracts/readerAnnotations';
import type {
    ConversationContentSourceV1,
    ConversationContentStateV1,
    ConversationSnapshotV1,
} from '../../contracts/conversationContent';
import type {
    ConversationTurnReadPortV1,
    ConversationTurnReadResultV1,
} from '../../contracts/conversationDiscovery';
import {
    getConversationDocumentIdentityKeyV1,
    getConversationSnapshotSourceQualityV1,
    getConversationTurnSourceQualityV1,
    type ConversationSnapshotSourceQualityV1,
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
    /** Canonical ChatGPT coverage; maintained conversation snapshots are complete. */
    coverage?: ConversationSnapshotV1['coverage'];
    /** Independent of coverage: whether every projected body is source-backed. */
    sourceQuality?: ConversationSnapshotSourceQualityV1;
    /** Optional diagnostic counts from a platform topology projection. */
    totalCount?: number;
    availableCount?: number;
};

export type FreshReaderItemResult = {
    item: ReaderItem;
    sourceRevision?: ReaderContentSourceRevision;
};

type CachedConversationReaderProjection = Readonly<{
    items: readonly ReaderItem[];
    annotationDocument: ReaderAnnotationDocument;
    coverage: ConversationSnapshotV1['coverage'];
    sourceQuality: ConversationSnapshotSourceQualityV1;
}>;

const conversationProjectionCache = new WeakMap<
    ConversationSnapshotV1,
    Map<string, CachedConversationReaderProjection>
>();

function getFallbackStartElement(adapter: SiteAdapter, messageElement: HTMLElement | null): HTMLElement | null {
    return messageElement ?? adapter.getLastMessageElement();
}

function getConversationContentSource(
    options: ReaderContentSourceOptions,
): ConversationContentSourceV1 | null {
    return options.conversationContentSource ?? null;
}

function getConversationTurnReadPort(
    source: ConversationContentSourceV1 | null,
): ConversationTurnReadPortV1 | null {
    if (!source || typeof (source as Partial<ConversationTurnReadPortV1>).readTurn !== 'function') {
        return null;
    }
    return source as unknown as ConversationTurnReadPortV1;
}

function resolveConversationStartTarget(
    materialization: ConversationMaterializationPortV1 | null | undefined,
    messageElement: HTMLElement | null,
    _snapshot?: ConversationSnapshotV1,
): { ok: true; target: ConversationTargetV1 | null } | { ok: false } {
    if (!messageElement) return { ok: true, target: null };
    const target = materialization?.resolveElement(messageElement) ?? null;
    if (target) return { ok: true, target };
    // DOM identity resolution belongs to the Host/Materialization Adapter.
    // Reader must not duplicate platform selectors or synthesize a target
    // from whichever attributes happen to be present on a remounted node.
    return { ok: false };
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
        items: snapshot.turns.map((turn) => buildConversationReaderItem(
            turn,
            snapshot.document,
            normalizedUrl,
        )),
        annotationDocument: {
            platform: 'chatgpt',
            conversationId: getConversationDocumentIdentityKeyV1(snapshot.document),
            title: snapshot.document.title,
            lastKnownUrl: normalizedUrl,
        },
    };
}

function buildConversationReaderItem(
    turn: ConversationSnapshotV1['turns'][number],
    document: ConversationSnapshotV1['document'],
    pageUrl: string,
): ReaderItem {
    return {
        id: `chatgpt-${turn.identity.assistantMessageId}`,
        userPrompt: turn.userText,
        // The ChatGPT discovery adapter has already normalized provider
        // Markdown before publishing the immutable snapshot.  Consumer
        // projection must not reinterpret it or create a second canonical
        // content path.
        content: turn.assistantMarkdown,
        meta: {
            platformId: document.platformId,
            messageId: turn.identity.assistantMessageId,
            roundId: turn.identity.turnId,
            userMessageId: turn.identity.userMessageId,
            assistantMessageId: turn.identity.assistantMessageId,
            position: turn.ordinal,
            url: pageUrl,
            bookmarkable: Boolean(document.conversationId),
            bookmarked: false,
            sourceQuality: getConversationTurnSourceQualityV1(turn),
        },
    };
}

function directReaderItemForTarget(
    source: ConversationContentSourceV1,
    target: ConversationTargetV1,
    pageUrl: string,
): FreshReaderItemResult | null {
    const port = getConversationTurnReadPort(source);
    if (!port) return null;
    const result: ConversationTurnReadResultV1 = port.readTurn(target);
    if (result.kind !== 'ready') return null;
    const state = source.read();
    const document = state.document;
    if (!document) return null;
    return {
        item: buildConversationReaderItem(result.turn, document, pageUrl),
        sourceRevision: {
            routeEpoch: 0,
            revision: 0,
            conversationId: getConversationDocumentIdentityKeyV1(document),
            contentToken: result.contentToken,
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
        conversationId: getConversationDocumentIdentityKeyV1(snapshot.document),
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

function getConversationReaderProjection(
    snapshot: ConversationSnapshotV1,
    pageUrl: string,
): CachedConversationReaderProjection {
    const normalizedUrl = normalizeChatGPTReaderPageUrl(pageUrl);
    let byUrl = conversationProjectionCache.get(snapshot);
    if (!byUrl) {
        byUrl = new Map();
        conversationProjectionCache.set(snapshot, byUrl);
    }
    const cached = byUrl.get(normalizedUrl);
    if (cached) return cached;

    const content = buildConversationReaderContent(snapshot, normalizedUrl);
    const projection: CachedConversationReaderProjection = Object.freeze({
        items: Object.freeze(content.items.map((item) => Object.freeze({
            ...item,
            meta: item.meta ? Object.freeze({ ...item.meta }) : undefined,
        }))),
        annotationDocument: Object.freeze({ ...content.annotationDocument }),
        coverage: snapshot.coverage,
        sourceQuality: getConversationSnapshotSourceQualityV1(snapshot),
    });
    byUrl.set(normalizedUrl, projection);
    return projection;
}

function createChatGPTEmptyResult(
    status: ReaderContentSourceStatus,
    sourceRevision?: ReaderContentSourceRevision,
    metadataSource: ReaderContentMetadataSource = 'chatgpt-content-v1',
): ReaderContentSourceResult {
    const result: ReaderContentSourceResult = {
        items: [],
        startIndex: 0,
        metadataSource,
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
    const content = getConversationReaderProjection(snapshot, pageUrl);
    const startIndex = resolveConversationStartIndex(snapshot, startTargetResolution.target);
    if (startIndex < 0) return createChatGPTEmptyResult('target-unresolved', sourceRevision);
    return {
        items: content.items.map((item) => cloneReaderItem(item, normalizeChatGPTReaderPageUrl(pageUrl))),
        startIndex,
        metadataSource: 'chatgpt-content-v1',
        coverage: content.coverage,
        sourceQuality: content.sourceQuality,
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
    // Compatibility name retained for non-ChatGPT callers and existing
    // consumer imports.  Ordinary ChatGPT consumption is a read of the last
    // published snapshot; discovery refresh belongs to lifecycle signals or
    // an explicit Reader Refresh action.
    return readCurrentConversationContent(startMessageElement, options);
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
    const source = getConversationContentSource(options);
    const target = options.conversationMaterialization?.resolveElement(messageElement) ?? null;
    if (source && target) {
        const direct = directReaderItemForTarget(
            source,
            target,
            normalizeChatGPTReaderPageUrl(options.pageUrl ?? window.location.href),
        );
        if (direct) return direct;
    }
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
