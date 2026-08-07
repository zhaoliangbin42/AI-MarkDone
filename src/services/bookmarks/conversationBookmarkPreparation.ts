import type { ConversationContentSourceV1 } from '../../contracts/conversationContent';
import type {
    ConversationMaterializationPortV1,
    ConversationTargetV1,
} from '../../contracts/conversationMaterialization';
import type {
    ConversationTurnReadPortV1,
} from '../../contracts/conversationDiscovery';
import type {
    ConversationDiscoveryPortV2,
    ConversationTurnRevisionV2,
} from '../../contracts/conversationDiscoveryV2';

export type PreparedConversationBookmarkV1 = Readonly<{
    target: ConversationTargetV1;
    userMessage: string;
    assistantMarkdown: string;
    messageId: string;
    position: number;
    contentRevision: string;
}>;

export type PreparedConversationBookmarkV2 = Readonly<{
    documentKey: string;
    messageId: string;
    position: number;
    userMessage: string;
    assistantMarkdown: string;
    revision: ConversationTurnRevisionV2;
}>;

/** The same one-read preparation seam for the V2 discovery port. */
export async function prepareChatGPTBookmarkV2(
    discovery: ConversationDiscoveryPortV2,
    messageElement: HTMLElement,
): Promise<PreparedConversationBookmarkV2 | null> {
    await discovery.refresh();
    const ref = discovery.resolveElement(messageElement);
    const snapshot = discovery.read();
    if (!ref || snapshot.kind !== 'ready') return null;
    const result = discovery.readTurn({ kind: 'entry', ref });
    if (result.kind !== 'ready') return null;
    const userMessage = result.turn.user.text.trim();
    const assistantMarkdown = result.turn.assistant.markdown.trim();
    const messageId = result.turn.identity.assistantMessageId.trim();
    if (!userMessage || !assistantMarkdown || !messageId || result.position <= 0) return null;
    return Object.freeze({
        documentKey: snapshot.document.documentKey,
        messageId,
        position: result.position,
        userMessage,
        assistantMarkdown,
        revision: result.revision,
    });
}

/**
 * Prepare all bookmark fields from one sealed conversation fact. The host
 * adapter supplies only the target; content, identity, ordinal and revision
 * are read from the same canonical source port.
 */
export async function prepareChatGPTBookmark(
    source: ConversationContentSourceV1,
    materialization: ConversationMaterializationPortV1,
    messageElement: HTMLElement,
): Promise<PreparedConversationBookmarkV1 | null> {
    const state = await source.refresh();
    const snapshot = state.snapshot;
    const target = materialization.resolveElement(messageElement);
    if (!snapshot || !state.document || !target) return null;
    if (target.documentKey !== snapshot.document.key) return null;

    const readPort = source as Partial<ConversationTurnReadPortV1>;
    if (typeof readPort.readTurn !== 'function') return null;
    const result = readPort.readTurn(target);
    if (result.kind !== 'ready') return null;

    const turn = snapshot.turns.find((candidate) => (
        candidate.identity.turnId === target.turnId
        && candidate.identity.assistantMessageId === target.assistantMessageId
        && candidate.identity.userMessageId === target.userMessageId
    ));
    if (!turn || result.turn !== turn) {
        // A compatible implementation may return an equivalent immutable
        // turn instance, so compare the typed identity and canonical body.
        if (!turn
            || result.turn.identity.turnId !== target.turnId
            || result.turn.identity.assistantMessageId !== target.assistantMessageId
            || result.turn.assistantMarkdown !== turn.assistantMarkdown) return null;
    }

    const userMessage = result.turn.userText.trim();
    const assistantMarkdown = result.turn.assistantMarkdown.trim();
    const messageId = result.turn.identity.assistantMessageId.trim();
    const position = result.turn.ordinal;
    const contentRevision = result.contentToken.trim();
    if (!userMessage || !assistantMarkdown || !messageId || !Number.isInteger(position) || position <= 0 || !contentRevision) {
        return null;
    }

    return Object.freeze({
        target: Object.freeze({ ...target }),
        userMessage,
        assistantMarkdown,
        messageId,
        position,
        contentRevision,
    });
}
