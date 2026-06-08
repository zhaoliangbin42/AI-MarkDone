import type { Theme } from '../../core/types/theme';
import type { ReaderSessionSnapshot } from '../../contracts/protocol';
import { resolveContent, type ReaderItem } from './types';

export async function buildReaderSessionSnapshot(params: {
    items: ReaderItem[];
    startIndex: number;
    sourceUrl: string;
    theme: Theme;
    now?: number;
}): Promise<ReaderSessionSnapshot> {
    const now = params.now ?? Date.now();
    const items = [];
    for (const item of params.items) {
        items.push({
            id: item.id,
            userPrompt: item.userPrompt,
            content: await resolveContent(item.content),
            meta: item.meta ? { ...item.meta } : undefined,
        });
    }
    return {
        items,
        startIndex: Math.max(0, Math.min(params.startIndex, Math.max(0, items.length - 1))),
        sourceUrl: params.sourceUrl,
        theme: params.theme,
        createdAt: now,
        updatedAt: now,
    };
}
