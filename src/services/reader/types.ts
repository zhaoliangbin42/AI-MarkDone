/**
 * Reader normalized data types (MVP).
 *
 * Principles:
 * - UI only cares about "what to show", not "where data comes from".
 * - Support lazy loading (performance): content can be computed on demand.
 */

import type { RichBlockV1, RichContentImageV1 } from '../../contracts/richContent';

export type ContentProvider = string | (() => string) | (() => Promise<string>);

export type ReaderItemMeta = {
    platformId?: string;
    documentKey?: string;
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
    /** Unfiltered captured Markdown, when available from ChatGPT. */
    sourceContent?: ContentProvider;
    richBlocks?: readonly RichBlockV1[];
    meta?: ReaderItemMeta;
};

export type ReaderRichContentLease = Readonly<{
    assets: readonly RichContentImageV1[];
    release: () => void | Promise<void>;
}>;
export type ReaderRichContentResolver = (item: ReaderItem, signal: AbortSignal) => Promise<ReaderRichContentLease>;

export async function resolveContent(provider: ContentProvider): Promise<string> {
    if (typeof provider === 'string') return provider;
    const value = provider();
    return value instanceof Promise ? await value : value;
}
