/**
 * Simplified Bookmark Types - AITimeline Pattern
 */

/**
 * Simple bookmark structure
 */
export interface Bookmark {
    url: string;
    urlWithoutProtocol: string;
    position: number;
    userMessage: string;
    aiResponse?: string; // AI response text (optional)
    timestamp: number;
    title?: string; // Custom title (defaults to userMessage)
    notes?: string; // Optional notes
    platform?: 'ChatGPT' | 'Gemini'; // Platform identifier
}
