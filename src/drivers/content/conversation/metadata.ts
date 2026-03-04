import type { SiteAdapter } from '../adapters/base';
import { detectPlatformId, platformDisplayName, type PlatformId } from '../../../contracts/platform';

export type ConversationDescriptor = { url: string; title: string; platformId: PlatformId };

function normalizeTitle(rawTitle: string): string {
    let title = (rawTitle || 'Conversation').trim() || 'Conversation';
    title = title
        .replace(' - ChatGPT', '')
        .replace(' - Claude', '')
        .replace(' - Gemini', '')
        .replace(' - DeepSeek', '')
        .trim();
    if (title.length > 100) title = `${title.substring(0, 100)}...`;
    return title || 'Conversation';
}

function toPlatformId(adapterPlatformId: string): PlatformId {
    if (adapterPlatformId === 'chatgpt') return 'chatgpt';
    if (adapterPlatformId === 'gemini') return 'gemini';
    if (adapterPlatformId === 'claude') return 'claude';
    if (adapterPlatformId === 'deepseek') return 'deepseek';
    return detectPlatformId(window.location.hostname);
}

export function getConversationDescriptor(adapter: SiteAdapter): ConversationDescriptor {
    const url = window.location.href;
    const rawTitle = document.querySelector('title')?.textContent?.trim() || 'Conversation';
    const title = normalizeTitle(rawTitle);
    const platformId = toPlatformId(adapter.getPlatformId());
    return { url, title, platformId };
}

export function buildConversationMetadata(adapter: SiteAdapter, count: number, now: Date = new Date()) {
    const desc = getConversationDescriptor(adapter);
    return {
        url: desc.url,
        exportedAt: now.toISOString(),
        title: desc.title,
        count,
        platform: platformDisplayName(desc.platformId),
    };
}

