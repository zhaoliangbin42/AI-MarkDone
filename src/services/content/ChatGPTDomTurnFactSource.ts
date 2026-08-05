import type { SiteAdapter } from '../../drivers/content/adapters/base';
import {
    collectConversationTurnRefs,
    type ConversationTurnRef,
} from '../../drivers/content/conversation/collectConversationTurnRefs';
import { listAssistantSegmentElements } from '../../drivers/content/conversation/assistantSegments';
import {
    collectChatGPTDomRoundRefs,
    invalidateChatGPTDomRoundSnapshot,
} from '../../drivers/content/chatgpt/domConversationDiscovery';
import type {
    ChatGPTDomTurnFact,
    ChatGPTDomTurnObservation,
} from '../../drivers/content/chatgpt/types';
import { copyMarkdownFromTurn } from '../copy/copy-turn-markdown';
import { copyMarkdownFromMessage } from '../copy/copy-markdown';

function normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function normalizeIdentity(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized || null;
}

function resolveTurnForDomRound(
    domRound: ReturnType<typeof collectChatGPTDomRoundRefs>[number],
    turns: ReturnType<typeof collectConversationTurnRefs>,
): ReturnType<typeof collectConversationTurnRefs>[number] | null {
    const structural = turns.filter((turn) => (
        turn.assistantRootEl === domRound.assistantRootEl
        || turn.userRootEl === domRound.userRootEl
        || turn.turnRootEl === domRound.assistantRootEl
    ));
    if (structural.length === 1) return structural[0]!;

    const expected = [
        domRound.identity.roundId,
        domRound.identity.userMessageId,
        domRound.identity.assistantMessageId,
        domRound.identity.assistantTurnId,
    ].map(normalizeIdentity).filter((value): value is string => value !== null);
    if (expected.length === 0) return null;
    const typed = turns.filter((turn) => {
        const observed = [
            turn.messageId,
            turn.primaryMessageEl.getAttribute('data-message-id'),
            turn.assistantRootEl?.getAttribute('data-turn-id'),
            turn.userRootEl?.getAttribute('data-message-id'),
            turn.turnRootEl.getAttribute('data-turn-id'),
        ].map(normalizeIdentity).filter((value): value is string => value !== null);
        return expected.some((value) => observed.includes(value));
    });
    return typed.length === 1 ? typed[0]! : null;
}

export class ChatGPTDomTurnFactSource {
    constructor(private readonly adapter: SiteAdapter) {}

    read(options: { completedAssistantMessageId?: string | null } = {}): ChatGPTDomTurnObservation {
        invalidateChatGPTDomRoundSnapshot(this.adapter);
        const domRounds = collectChatGPTDomRoundRefs(this.adapter);
        const turns = collectConversationTurnRefs(this.adapter);
        const rounds: ChatGPTDomTurnFact[] = domRounds.length > 0
            ? domRounds.map((domRound, index) => {
                const turn = resolveTurnForDomRound(domRound, turns);
                const assistantElement = turn?.primaryMessageEl ?? domRound.assistantMessageEl;
                const isStreaming = domRound.isStreaming
                    && domRound.identity.assistantMessageId !== options.completedAssistantMessageId;
                const copied = !isStreaming && domRound.identity.assistantMessageId
                    ? turn
                        ? copyMarkdownFromTurn(this.adapter, turn.messageEls)
                        : copyMarkdownFromMessage(this.adapter, assistantElement)
                    : null;
                const assistantContent = copied?.ok ? copied.markdown.trim() : '';
                const userPrompt = normalizeText(
                    domRound.userMessageEl.textContent
                    || turn?.userPrompt
                    || this.adapter.extractUserPrompt(assistantElement),
                );
                const hasTypedIdentity = Boolean(
                    (domRound.identity.roundId
                        || domRound.identity.assistantTurnId
                        || domRound.identity.assistantMessageId)
                    && domRound.identity.assistantMessageId,
                );
                const status: ChatGPTDomTurnFact['status'] = isStreaming
                    ? 'streaming'
                    : hasTypedIdentity && userPrompt && assistantContent
                        ? 'complete'
                        : 'incomplete';
                return {
                    position: index + 1,
                    roundId: domRound.identity.roundId,
                    userMessageId: domRound.identity.userMessageId,
                    assistantMessageId: domRound.identity.assistantMessageId,
                    assistantTurnId: domRound.identity.assistantTurnId,
                    userPrompt,
                    assistantContent,
                    status,
                };
            })
            : buildFallbackFacts(
                this.adapter,
                turns.length > 0 ? turns : buildLegacyTurns(this.adapter),
                options.completedAssistantMessageId,
            );
        return {
            observedAt: Date.now(),
            rounds,
        };
    }
}

function buildLegacyTurns(adapter: SiteAdapter): ConversationTurnRef[] {
    return listAssistantSegmentElements(adapter).map((message, index) => {
        const turnRoot = adapter.getTurnRootElement?.(message) ?? message;
        const userMessage = findPreviousUserMessage(message);
        const userRoot = userMessage?.closest(
            '[data-turn-id-container], [data-testid^="conversation-turn-"], article[data-turn], section[data-turn], [data-turn]',
        );
        const extractedPrompt = adapter.extractUserPrompt(message);
        return {
            index,
            primaryMessageEl: message,
            messageEls: [message],
            userPrompt: normalizeText(extractedPrompt || userMessage?.textContent || `Message ${index + 1}`),
            messageId: normalizeIdentity(adapter.getMessageId(message) ?? message.getAttribute('data-message-id')),
            turnRootEl: turnRoot,
            assistantRootEl: turnRoot,
            userRootEl: userRoot instanceof HTMLElement ? userRoot : userMessage,
            jumpAnchorEl: userRoot instanceof HTMLElement ? userRoot : userMessage ?? turnRoot,
            groupEls: [userRoot instanceof HTMLElement ? userRoot : userMessage, turnRoot]
                .filter((node): node is HTMLElement => node instanceof HTMLElement),
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
 * is absent even though the assistant message node and its visible Markdown
 * are already mounted. `collectConversationTurnRefs` still gives us a typed
 * assistant identity in that window; expose it as partial evidence instead
 * of publishing an empty conversation and making Directory/Reader disappear.
 */
function buildFallbackFacts(
    adapter: SiteAdapter,
    turns: ConversationTurnRef[],
    completedAssistantMessageId?: string | null,
): ChatGPTDomTurnFact[] {
    return turns.map((turn, index) => {
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
        const copied = !isStreaming && assistantMessageId
            ? copyMarkdownFromTurn(adapter, turn.messageEls)
            : null;
        const assistantContent = copied?.ok ? copied.markdown.trim() : '';
        const userPrompt = normalizeText(turn.userPrompt);
        const status: ChatGPTDomTurnFact['status'] = isStreaming
            ? 'streaming'
            : assistantMessageId && userPrompt && assistantContent
                ? 'complete'
                : 'incomplete';
        return {
            position: index + 1,
            roundId,
            userMessageId,
            assistantMessageId,
            assistantTurnId,
            userPrompt,
            assistantContent,
            status,
        };
    });
}
