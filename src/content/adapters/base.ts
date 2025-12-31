/**
 * Base adapter interface for LLM platforms
 * Defines common methods that each platform must implement
 */
export abstract class SiteAdapter {
    /**
     * Check if current URL matches this adapter
     */
    abstract matches(url: string): boolean;

    /**
     * Get selector for message containers
     */
    abstract getMessageSelector(): string;

    /**
     * Get selector for message content area
     */
    abstract getMessageContentSelector(): string;

    /**
     * Get selector for action bar (where toolbar will be injected)
     */
    abstract getActionBarSelector(): string;

    /**
     * Get the copy button selector for streaming completion detection
     * Different platforms may use different aria-labels or attributes
     */
    abstract getCopyButtonSelector(): string;

    /**
     * Extract raw HTML content from message element
     */
    abstract extractMessageHTML(element: HTMLElement): string;

    /**
     * Check if message is currently being streamed
     */
    abstract isStreamingMessage(element: HTMLElement): boolean;

    /**
     * Get unique identifier for a message
     */
    abstract getMessageId(element: HTMLElement): string | null;

    /**
     * Get the main container to observe for mutations
     */
    abstract getObserverContainer(): HTMLElement | null;
}
