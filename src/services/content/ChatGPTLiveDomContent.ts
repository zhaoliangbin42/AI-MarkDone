import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ChatGPTConversationEngine } from '../../drivers/content/chatgpt/ChatGPTConversationEngine';
import {
    collectChatGPTDomRoundRefs,
    subscribeChatGPTDomMutations,
    type ChatGPTDomRoundRef,
} from '../../drivers/content/chatgpt/domConversationDiscovery';
import type {
    ChatGPTConversationRound,
    ChatGPTConversationSnapshot,
} from '../../drivers/content/chatgpt/types';
import { copyMarkdownFromMessage } from '../copy/copy-markdown';

type ChatGPTLiveDomContentEngine = Pick<
    ChatGPTConversationEngine,
    'applyLiveDomTail' | 'peekCurrentSnapshot' | 'registerLiveDomReconciler' | 'subscribe'
>;

const REFRESH_DEBOUNCE_MS = 120;

function normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function truncatePreview(value: string, maxLength = 180): string {
    const text = normalizeText(value).replace(/\s+/g, ' ');
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function roundMatchesSnapshot(
    domRound: ChatGPTDomRoundRef,
    snapshotRound: ChatGPTConversationRound,
): boolean {
    const identity = domRound.identity;
    if (
        identity.userMessageId
        && snapshotRound.userMessageId
        && identity.userMessageId !== snapshotRound.userMessageId
    ) {
        return false;
    }
    if (
        identity.assistantMessageId
        && snapshotRound.assistantMessageId
        && identity.assistantMessageId !== snapshotRound.assistantMessageId
    ) {
        return false;
    }
    return Boolean(
        (identity.roundId && identity.roundId === snapshotRound.id)
        || (identity.userMessageId && identity.userMessageId === snapshotRound.userMessageId)
        || (identity.assistantMessageId && (
            identity.assistantMessageId === snapshotRound.assistantMessageId
            || identity.assistantMessageId === snapshotRound.messageId
        ))
        || (identity.assistantTurnId && (
            identity.assistantTurnId === snapshotRound.id
            || identity.assistantTurnId === snapshotRound.assistantMessageId
            || identity.assistantTurnId === snapshotRound.messageId
        )),
    );
}

function findUniqueSnapshotRoundIndex(
    domRound: ChatGPTDomRoundRef,
    snapshot: ChatGPTConversationSnapshot,
): number {
    const matches = snapshot.rounds
        .map((round, index) => ({ round, index }))
        .filter(({ round }) => roundMatchesSnapshot(domRound, round));
    return matches.length === 1 ? matches[0]!.index : -1;
}

function buildLiveRound(
    adapter: SiteAdapter,
    domRound: ChatGPTDomRoundRef,
    position: number,
): ChatGPTConversationRound | null {
    if (domRound.isStreaming) return null;
    if (!adapter.getToolbarAnchorElement(domRound.assistantMessageEl)) return null;

    const identity = domRound.identity;
    const assistantMessageId = identity.assistantMessageId?.trim() || null;
    const userMessageId = identity.userMessageId?.trim() || null;
    const roundId = identity.roundId?.trim()
        || identity.assistantTurnId?.trim()
        || userMessageId
        || null;
    if (!assistantMessageId || !userMessageId || !roundId) return null;

    const userPrompt = normalizeText(
        domRound.userMessageEl.textContent
        || adapter.extractUserPrompt(domRound.assistantMessageEl),
    );
    const copied = copyMarkdownFromMessage(adapter, domRound.assistantMessageEl);
    const assistantContent = copied.ok ? copied.markdown.trim() : '';
    if (!userPrompt || !assistantContent) return null;

    return {
        id: roundId,
        position,
        userPrompt,
        assistantContent,
        preview: truncatePreview(userPrompt),
        messageId: assistantMessageId,
        userMessageId,
        assistantMessageId,
    };
}

function buildCanonicalTailCompletion(
    adapter: SiteAdapter,
    domRound: ChatGPTDomRoundRef,
    snapshotRound: ChatGPTConversationRound,
): ChatGPTConversationRound | null {
    if (snapshotRound.assistantContent.trim()) return null;
    const liveRound = buildLiveRound(adapter, domRound, snapshotRound.position);
    if (!liveRound) return null;
    if (
        snapshotRound.userMessageId
        && liveRound.userMessageId !== snapshotRound.userMessageId
    ) {
        return null;
    }
    if (
        snapshotRound.assistantMessageId
        && liveRound.assistantMessageId !== snapshotRound.assistantMessageId
    ) {
        return null;
    }
    return {
        ...liveRound,
        id: snapshotRound.id,
        userPrompt: snapshotRound.userPrompt,
        preview: snapshotRound.preview,
        userMessageId: snapshotRound.userMessageId ?? liveRound.userMessageId,
    };
}

export function collectChatGPTLiveDomTail(
    adapter: SiteAdapter,
    snapshot: ChatGPTConversationSnapshot,
): ChatGPTConversationRound[] {
    const domRounds = collectChatGPTDomRoundRefs(adapter);
    let lastKnownDomIndex = -1;
    let lastKnownSnapshotIndex = -1;
    for (let index = 0; index < domRounds.length; index += 1) {
        const snapshotIndex = findUniqueSnapshotRoundIndex(domRounds[index]!, snapshot);
        if (snapshotIndex < 0) continue;
        if (snapshotIndex >= lastKnownSnapshotIndex) {
            lastKnownDomIndex = index;
            lastKnownSnapshotIndex = snapshotIndex;
        }
    }
    if (
        lastKnownDomIndex < 0
        || lastKnownSnapshotIndex !== snapshot.rounds.length - 1
    ) {
        return [];
    }

    const tail: ChatGPTConversationRound[] = [];
    const snapshotTail = snapshot.rounds[lastKnownSnapshotIndex];
    const mountedSnapshotTail = domRounds[lastKnownDomIndex];
    if (snapshotTail && mountedSnapshotTail) {
        const completion = buildCanonicalTailCompletion(
            adapter,
            mountedSnapshotTail,
            snapshotTail,
        );
        if (completion) tail.push(completion);
    }
    for (const [tailIndex, domRound] of domRounds.slice(lastKnownDomIndex + 1).entries()) {
        if (findUniqueSnapshotRoundIndex(domRound, snapshot) >= 0) return [];
        const liveRound = buildLiveRound(
            adapter,
            domRound,
            snapshot.rounds.length + tailIndex + 1,
        );
        if (!liveRound) break;
        tail.push(liveRound);
    }
    return tail;
}

export class ChatGPTLiveDomContent {
    private refreshTimer: number | null = null;
    private refreshPending = true;
    private unsubscribeDomMutations: (() => void) | null = null;
    private unsubscribeSnapshot: (() => void) | null = null;
    private unregisterLiveDomReconciler: (() => void) | null = null;

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly engine: ChatGPTLiveDomContentEngine,
    ) {}

    init(): void {
        if (this.unsubscribeDomMutations || this.adapter.getPlatformId() !== 'chatgpt') return;
        this.refreshPending = true;
        this.unsubscribeDomMutations = subscribeChatGPTDomMutations(
            this.adapter,
            () => this.scheduleRefresh(),
        );
        this.unsubscribeSnapshot = this.engine.subscribe(
            () => this.scheduleRefresh(),
            { live: false },
        );
        this.unregisterLiveDomReconciler = this.engine.registerLiveDomReconciler(
            () => this.reconcileImmediately(),
        );
        this.scheduleRefresh();
    }

    dispose(): void {
        this.unsubscribeDomMutations?.();
        this.unsubscribeDomMutations = null;
        this.unsubscribeSnapshot?.();
        this.unsubscribeSnapshot = null;
        this.unregisterLiveDomReconciler?.();
        this.unregisterLiveDomReconciler = null;
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.refreshPending = false;
    }

    private scheduleRefresh(): void {
        this.refreshPending = true;
        if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            this.refresh();
        }, REFRESH_DEBOUNCE_MS);
    }

    private reconcileImmediately(): ChatGPTConversationSnapshot | null {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        return this.refresh();
    }

    private refresh(): ChatGPTConversationSnapshot | null {
        const snapshot = this.engine.peekCurrentSnapshot();
        if (!snapshot?.rounds.length) return snapshot;
        if (!this.refreshPending) return snapshot;
        this.refreshPending = false;
        const tail = collectChatGPTLiveDomTail(this.adapter, snapshot);
        if (tail.length === 0) return snapshot;
        const reconciled = this.engine.applyLiveDomTail(snapshot.branchKey, tail);
        this.refreshPending = false;
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        return reconciled;
    }
}
