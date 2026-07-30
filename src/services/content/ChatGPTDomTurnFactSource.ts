import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { collectConversationTurnRefs } from '../../drivers/content/conversation/collectConversationTurnRefs';
import {
    collectChatGPTDomRoundRefs,
    invalidateChatGPTDomRoundSnapshot,
    subscribeChatGPTDomMutations,
} from '../../drivers/content/chatgpt/domConversationDiscovery';
import type {
    ChatGPTDomTurnFact,
    ChatGPTDomTurnFactSource as ChatGPTDomTurnFactSourceContract,
    ChatGPTDomTurnObservation,
} from '../../drivers/content/chatgpt/types';
import { copyMarkdownFromTurn } from '../copy/copy-turn-markdown';

function normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

export class ChatGPTDomTurnFactSource implements ChatGPTDomTurnFactSourceContract {
    private listener: ((observation: ChatGPTDomTurnObservation) => void) | null = null;
    private unsubscribe: (() => void) | null = null;
    private queued = false;

    constructor(private readonly adapter: SiteAdapter) {}

    start(listener: (observation: ChatGPTDomTurnObservation) => void): void {
        this.listener = listener;
        if (this.unsubscribe || this.adapter.getPlatformId() !== 'chatgpt') return;
        this.unsubscribe = subscribeChatGPTDomMutations(this.adapter, () => {
            if (this.queued) return;
            this.queued = true;
            queueMicrotask(() => {
                this.queued = false;
                this.listener?.(this.read());
            });
        });
    }

    stop(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.listener = null;
        this.queued = false;
    }

    read(): ChatGPTDomTurnObservation {
        invalidateChatGPTDomRoundSnapshot(this.adapter);
        const domRounds = collectChatGPTDomRoundRefs(this.adapter);
        const turns = collectConversationTurnRefs(this.adapter);
        const rounds: ChatGPTDomTurnFact[] = domRounds.map((domRound, index) => {
            const turn = turns[index] ?? null;
            const assistantElement = turn?.primaryMessageEl ?? domRound.assistantMessageEl;
            const hasCompletionAnchor = Boolean(
                this.adapter.getToolbarAnchorElement(assistantElement),
            );
            const copied = !domRound.isStreaming && hasCompletionAnchor && turn
                ? copyMarkdownFromTurn(this.adapter, turn.messageEls)
                : null;
            const assistantContent = copied?.ok ? copied.markdown.trim() : '';
            const userPrompt = normalizeText(
                domRound.userMessageEl.textContent
                || turn?.userPrompt
                || this.adapter.extractUserPrompt(assistantElement),
            );
            const hasTypedIdentity = Boolean(
                (domRound.identity.roundId || domRound.identity.assistantTurnId)
                && domRound.identity.userMessageId
                && domRound.identity.assistantMessageId,
            );
            const status: ChatGPTDomTurnFact['status'] = domRound.isStreaming
                ? 'streaming'
                : hasTypedIdentity && hasCompletionAnchor && userPrompt && assistantContent
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
        });
        return {
            observedAt: Date.now(),
            rounds,
        };
    }
}
