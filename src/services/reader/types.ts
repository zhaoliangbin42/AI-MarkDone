/**
 * Reader normalized data types (MVP).
 *
 * Principles:
 * - UI only cares about "what to show", not "where data comes from".
 * - Support lazy loading (performance): content can be computed on demand.
 */

export type ContentProvider = string | (() => string) | (() => Promise<string>);

export type ReaderItemMeta = {
    platformId?: string;
    messageId?: string | null;
    roundId?: string | null;
    userMessageId?: string | null;
    assistantMessageId?: string | null;
    branchKey?: string | null;
    position?: number;
    url?: string;
    bookmarkable?: boolean;
    bookmarked?: boolean;
    /**
     * Whether Markdown came from a canonical provider source or a lossy
     * rendered-surface reconstruction. Missing means a legacy/non-V1 source.
     */
    sourceQuality?: 'source-backed' | 'host-rendered' | 'reconstructed';
};

export type ReaderItem = {
    id: string;
    userPrompt: string;
    content: ContentProvider;
    meta?: ReaderItemMeta;
};

export async function resolveContent(provider: ContentProvider): Promise<string> {
    if (typeof provider === 'string') return provider;
    const value = provider();
    return value instanceof Promise ? await value : value;
}
