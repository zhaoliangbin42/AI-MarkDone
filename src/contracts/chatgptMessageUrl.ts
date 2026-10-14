import { getChatGPTConversationId } from './chatgptConversationId';
import { isChatGPTPageHostname } from './chatgptHosts';

const messagePositionParameters = [
    'message',
    'messageId',
    'historySearchQuery',
    'selectedTextQuery',
    'selectedTextOccurrence',
] as const;

/** Builds a host-owned message target from an existing canonical message identity. */
export function buildChatGPTMessageUrl(url: string, messageId: string | null | undefined): string | null {
    if (typeof messageId !== 'string' || !messageId || /[\s\u0000-\u001f\u007f-\u009f]/u.test(messageId)) return null;
    // Host slot keys and extension-generated turn identities are not message IDs.
    if (/^(?:fallback-turn-|chatgpt-turn:|chatgpt-message-slot:)/i.test(messageId)
        || messageId === 'client-created-root' || /^conversation-turn-\d+$/i.test(messageId)) return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
            || !isChatGPTPageHostname(parsed.hostname) || !getChatGPTConversationId(parsed.toString())) return null;
        parsed.hostname = 'chatgpt.com';
        parsed.hash = '';
        for (const parameter of messagePositionParameters) parsed.searchParams.delete(parameter);
        parsed.searchParams.set('messageId', messageId);
        return parsed.searchParams.get('messageId') === messageId ? parsed.toString() : null;
    } catch {
        return null;
    }
}
