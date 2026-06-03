export type PlatformId = 'chatgpt' | 'unknown';

export function platformDisplayName(id: PlatformId): string {
    switch (id) {
        case 'chatgpt':
            return 'ChatGPT';
        default:
            return 'Unknown';
    }
}

export function detectPlatformId(hostname: string): PlatformId {
    const h = hostname.toLowerCase();
    if (h === 'chat.openai.com' || h.endsWith('.chat.openai.com') || h === 'chatgpt.com' || h.endsWith('.chatgpt.com')) return 'chatgpt';
    return 'unknown';
}

export function isSupportedPlatformId(id: PlatformId): boolean {
    return id !== 'unknown';
}
