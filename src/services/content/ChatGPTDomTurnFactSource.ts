import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { listAssistantSegmentElements } from '../../drivers/content/conversation/assistantSegments';
import {
    collectChatGPTDomRoundRefs,
    getChatGPTPageIndex,
    invalidateChatGPTDomRoundSnapshot,
} from '../../drivers/content/chatgpt/domConversationDiscovery';
import type { ChatGPTPageIndex } from '../../drivers/content/chatgpt/ChatGPTPageIndex';
import type {
    ChatGPTDomTurnFact,
    ChatGPTDomTurnObservation,
} from '../../drivers/content/chatgpt/types';

function normalizeIdentity(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

export class ChatGPTDomTurnFactSource {
    private readonly pageIndex: ChatGPTPageIndex;

    constructor(private readonly adapter: SiteAdapter) {
        this.pageIndex = getChatGPTPageIndex(adapter);
    }

    read(options: {
        completedAssistantMessageId?: string | null;
        assistantMessageIds?: readonly string[];
        observationRevision?: number;
    } = {}): ChatGPTDomTurnObservation {
        invalidateChatGPTDomRoundSnapshot(this.adapter);
        const domRounds = collectChatGPTDomRoundRefs(this.adapter);
        const requestedAssistantIds = options.assistantMessageIds
            ? new Set(options.assistantMessageIds.map((id) => id.trim()).filter(Boolean))
            : null;
        const selectedDomRounds = requestedAssistantIds && requestedAssistantIds.size > 0
            ? domRounds.filter((round) => round.identity.assistantMessageId
                && requestedAssistantIds.has(round.identity.assistantMessageId))
            : domRounds;
        const rounds: ChatGPTDomTurnFact[] = domRounds.length > 0
            ? selectedDomRounds.map((domRound) => {
                const isStreaming = domRound.isStreaming
                    && domRound.identity.assistantMessageId !== options.completedAssistantMessageId;
                const hasTypedIdentity = Boolean(
                    (domRound.identity.roundId
                        || domRound.identity.assistantTurnId
                        || domRound.identity.assistantMessageId)
                    && domRound.identity.assistantMessageId,
                );
                const status: ChatGPTDomTurnFact['status'] = isStreaming
                    ? 'streaming'
                    : hasTypedIdentity
                        ? 'mounted'
                        : 'incomplete';
                return {
                    roundId: domRound.identity.roundId,
                    userMessageId: domRound.identity.userMessageId,
                    assistantMessageId: domRound.identity.assistantMessageId,
                    assistantTurnId: domRound.identity.assistantTurnId,
                    status,
                };
            })
            : buildFallbackFacts(
                this.adapter,
                buildLegacyTurns(this.adapter).filter((turn) => (
                    !requestedAssistantIds
                    || requestedAssistantIds.size === 0
                    || (turn.messageId && requestedAssistantIds.has(turn.messageId))
                )),
                options.completedAssistantMessageId,
            );
        return {
            observedAt: options.observationRevision ?? this.pageIndex.getObservationRevision(),
            rounds,
        };
    }
}

type HostTurnRef = Readonly<{
    primaryMessageEl: HTMLElement;
    messageId: string | null;
    turnRootEl: HTMLElement;
    assistantRootEl: HTMLElement;
    userRootEl: HTMLElement | null;
    isStreaming: boolean;
}>;

function buildLegacyTurns(adapter: SiteAdapter): HostTurnRef[] {
    return listAssistantSegmentElements(adapter).map((message) => {
        const turnRoot = adapter.getTurnRootElement?.(message) ?? message;
        const userMessage = findPreviousUserMessage(message);
        const userRoot = userMessage?.closest(
            '[data-turn-id-container], [data-testid^="conversation-turn-"], article[data-turn], section[data-turn], [data-turn]',
        );
        return {
            primaryMessageEl: message,
            messageId: normalizeIdentity(adapter.getMessageId(message) ?? message.getAttribute('data-message-id')),
            turnRootEl: turnRoot,
            assistantRootEl: turnRoot,
            userRootEl: userRoot instanceof HTMLElement ? userRoot : userMessage,
            isStreaming: adapter.isStreamingMessage(message),
        };
    });
}

function findPreviousUserMessage(message: HTMLElement): HTMLElement | null {
    const roleNodes = Array.from(document.querySelectorAll('[data-message-author-role]'))
        .filter((node): node is HTMLElement => node instanceof HTMLElement);
    const messageIndex = roleNodes.indexOf(message);
    if (messageIndex < 0) return null;
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
        const candidate = roleNodes[index];
        if (candidate?.getAttribute('data-message-author-role') === 'user') return candidate;
    }
    return null;
}

/**
 * The ChatGPT DOM has shipped transient layouts where the typed turn wrapper
 * is absent even though an assistant message node is already mounted.
 * The direct assistant anchor still gives us a typed identity in that window;
 * expose only that lifecycle fact and leave body discovery to the Source Graph.
 */
function buildFallbackFacts(
    adapter: SiteAdapter,
    turns: HostTurnRef[],
    completedAssistantMessageId?: string | null,
): ChatGPTDomTurnFact[] {
    return turns.map((turn) => {
        const assistantElement = turn.primaryMessageEl;
        const assistantMessageId = normalizeIdentity(
            turn.messageId
                || adapter.getMessageId(assistantElement)
                || assistantElement.getAttribute('data-message-id'),
        );
        const assistantRoot = turn.assistantRootEl ?? turn.turnRootEl;
        const roundId = normalizeIdentity(
            turn.userRootEl?.getAttribute('data-turn-id')
                || turn.turnRootEl.getAttribute('data-turn-id'),
        );
        const assistantTurnId = normalizeIdentity(
            assistantRoot?.getAttribute('data-turn-id')
                || assistantRoot?.getAttribute('data-turn-id-container')
                || assistantRoot?.getAttribute('data-testid'),
        );
        const userMessageId = normalizeIdentity(
            turn.userRootEl?.getAttribute('data-message-id')
                || turn.userRootEl?.querySelector('[data-message-author-role="user"]')?.getAttribute('data-message-id'),
        );
        const isStreaming = turn.isStreaming && assistantMessageId !== completedAssistantMessageId;
        const status: ChatGPTDomTurnFact['status'] = isStreaming
            ? 'streaming'
            : assistantMessageId
                ? 'mounted'
                : 'incomplete';
        return {
            roundId,
            userMessageId,
            assistantMessageId,
            assistantTurnId,
            status,
        };
    });
}
