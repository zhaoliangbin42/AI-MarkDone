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
    'applyLiveDomTail' | 'peekCurrentSnapshot' | 'subscribe'
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
        || lastKnownDomIndex === domRounds.length - 1
    ) {
        return [];
    }

    const tail: ChatGPTConversationRound[] = [];
    for (const [tailIndex, domRound] of domRounds.slice(lastKnownDomIndex + 1).entries()) {
        if (findUniqueSnapshotRoundIndex(domRound, snapshot) >= 0) return [];
        const liveRound = buildLiveRound(
            adapter,
            domRound,
            snapshot.rounds.length + tailIndex + 1,
        );
        if (!liveRound) return [];
        tail.push(liveRound);
    }
    return tail;
}

export class ChatGPTLiveDomContent {
    private refreshTimer: number | null = null;
    private unsubscribeDomMutations: (() => void) | null = null;
    private unsubscribeSnapshot: (() => void) | null = null;

    constructor(
        private readonly adapter: SiteAdapter,
        private readonly engine: ChatGPTLiveDomContentEngine,
    ) {}

    init(): void {
        if (this.unsubscribeDomMutations || this.adapter.getPlatformId() !== 'chatgpt') return;
        this.unsubscribeDomMutations = subscribeChatGPTDomMutations(
            this.adapter,
            () => this.scheduleRefresh(),
        );
        this.unsubscribeSnapshot = this.engine.subscribe(
            () => this.scheduleRefresh(),
            { live: false },
        );
        this.scheduleRefresh();
    }

    dispose(): void {
        this.unsubscribeDomMutations?.();
        this.unsubscribeDomMutations = null;
        this.unsubscribeSnapshot?.();
        this.unsubscribeSnapshot = null;
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    private scheduleRefresh(): void {
        if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            this.refresh();
        }, REFRESH_DEBOUNCE_MS);
    }

    private refresh(): void {
        const snapshot = this.engine.peekCurrentSnapshot();
        if (!snapshot?.rounds.length) return;
        const tail = collectChatGPTLiveDomTail(this.adapter, snapshot);
        if (tail.length === 0) return;
        this.engine.applyLiveDomTail(snapshot.branchKey, tail);
    }
}
