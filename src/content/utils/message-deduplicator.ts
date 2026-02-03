/**
 * Shared message deduplicator utility
 * Removes nested duplicates from message lists
 * Complexity: O(n×d) where d=DOM depth (~10)
 */
export class MessageDeduplicator {
    /**
     * Remove nested duplicates from message list
     * Keeps outer containers, removes inner ones
     * 
     * @example
     * // ChatGPT: Both match but inner is duplicate
     * <article data-turn="assistant">     <!-- keep -->
     *   <div data-message-author-role="assistant"> <!-- remove -->
     *     <p>Response</p>
     *   </div>
     * </article>
     */
    static deduplicate(messages: Element[]): Element[] {
        if (messages.length === 0) return [];

        const messageSet = new Set(messages);

        return messages.filter(msg => {
            // Walk up DOM tree to check if any ancestor is in the set
            let parent = msg.parentElement;
            while (parent) {
                if (messageSet.has(parent)) {
                    return false; // msg is nested inside another message
                }
                parent = parent.parentElement;
            }
            return true; // msg is top-level
        });
    }
}
