import { getChatGPTConversationId } from '../../../contracts/chatgptConversationId';
export { getChatGPTConversationId } from '../../../contracts/chatgptConversationId';
export { buildChatGPTMessageUrl } from '../../../contracts/chatgptMessageUrl';

export function isChatGPTConversationPage(url: string): boolean {
    return getChatGPTConversationId(url) !== null;
}

/**
 * Ask ChatGPT to build its official conversation-navigation skeleton on reload.
 * An empty value is intentional: non-empty values are treated as a concrete
 * message target by the host page rather than as the navigation trigger.
 */
export function withChatGPTMessageNavigationTrigger(url: string): string {
    if (!isChatGPTConversationPage(url)) return url;
    try {
        const parsed = new URL(
            url,
            typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com',
        );
        parsed.searchParams.set('message', '');
        return parsed.toString();
    } catch {
        return url;
    }
}
