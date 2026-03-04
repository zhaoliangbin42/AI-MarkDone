import type { SiteAdapter } from '../adapters/base';
import { collectConversationTurnRefs } from './collectConversationTurnRefs';

export type ConversationMessageRef = {
    index: number;
    messageEl: HTMLElement;
    messageEls: HTMLElement[];
    userPrompt: string;
    messageId: string | null;
};

export function collectConversationMessageRefs(adapter: SiteAdapter): ConversationMessageRef[] {
    // Back-compat alias: the source-of-truth is `collectConversationTurnRefs()`.
    return collectConversationTurnRefs(adapter).map((turn) => ({
        index: turn.index,
        messageEl: turn.primaryMessageEl,
        messageEls: turn.messageEls,
        userPrompt: turn.userPrompt,
        messageId: turn.messageId,
    }));
}
