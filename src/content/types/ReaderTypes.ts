/**
 * ReaderPanel normalized data types.
 *
 * Principles:
 * - ReaderPanel only cares about "what to show", not "where data comes from".
 * - Support lazy loading (performance).
 * - Fully decoupled from data sources.
 */

/**
 * Content provider type:
 * - String: static content (e.g., bookmarks)
 * - Function: lazy provider for live pages
 */
export type ContentProvider = string | (() => string) | (() => Promise<string>);

/**
 * Reader item.
 * Contains everything needed to render a single page.
 */
export interface ReaderItem {
    /** Unique identifier (used as cache key). */
    id: string | number;

    /** User prompt (usually short; provided directly). */
    userPrompt: string;

    /** AI response content (may be lazy). */
    content: ContentProvider;

    /** Metadata (for UI display). */
    meta?: ReaderItemMeta;
}

/**
 * Reader item metadata.
 */
export interface ReaderItemMeta {
    /** Platform name (ChatGPT, Gemini, ...). */
    platform?: string;

    /** Platform icon (SVG string). */
    platformIcon?: string;

    /** Model name. */
    modelName?: string;

    /** Timestamp. */
    timestamp?: number;
}

/**
 * Resolve a content provider into the final Markdown string.
 * Handles string | sync function | async function.
 */
export async function resolveContent(provider: ContentProvider): Promise<string> {
    if (typeof provider === 'string') {
        return provider;
    }

    const result = provider();
    if (result instanceof Promise) {
        return await result;
    }
    return result;
}
