/**
 * Message collector for pagination
 * Collects article references WITHOUT parsing content (lazy loading)
 */
export interface MessageRef {
    index: number;
    element: HTMLElement;
    parsed?: string; // Cached parsed content
    userPrompt?: string; // User's original query for tooltip display
}


export class MessageCollector {
    /**
     * Collect all message articles (lazy - only get DOM refs)
     */
    static collectMessages(): MessageRef[] {
        const messages: MessageRef[] = [];

        // ChatGPT: article[data-testid^="conversation-turn-"]
        const chatgptArticles = document.querySelectorAll<HTMLElement>(
            'article[data-testid^="conversation-turn-"]'
        );

        // Gemini: message-content (需要根据实际DOM调整)
        const geminiArticles = document.querySelectorAll<HTMLElement>(
            'message-content, .model-response-text'
        );

        // 优先ChatGPT,fallback到Gemini
        const articles = chatgptArticles.length > 0
            ? Array.from(chatgptArticles)
            : Array.from(geminiArticles);

        articles.forEach((element, index) => {
            messages.push({
                index,
                element,
            });
        });

        return messages;
    }

    /**
     * Find initial message index by element
     */
    static findMessageIndex(target: HTMLElement, messages: MessageRef[]): number {
        return messages.findIndex(msg => msg.element === target || msg.element.contains(target));
    }
}
