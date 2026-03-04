export type PlatformId = 'chatgpt' | 'gemini' | 'claude' | 'deepseek' | 'unknown';

export function platformDisplayName(id: PlatformId): string {
    switch (id) {
        case 'chatgpt':
            return 'ChatGPT';
        case 'gemini':
            return 'Gemini';
        case 'claude':
            return 'Claude';
        case 'deepseek':
            return 'DeepSeek';
        default:
            return 'Unknown';
    }
}

export function detectPlatformId(hostname: string): PlatformId {
    const h = hostname.toLowerCase();
    if (h === 'chat.openai.com' || h.endsWith('.chat.openai.com') || h === 'chatgpt.com' || h.endsWith('.chatgpt.com')) return 'chatgpt';
    if (h === 'gemini.google.com' || h.endsWith('.gemini.google.com')) return 'gemini';
    if (h === 'claude.ai' || h.endsWith('.claude.ai')) return 'claude';
    if (h === 'chat.deepseek.com' || h.endsWith('.chat.deepseek.com')) return 'deepseek';
    return 'unknown';
}

export function isSupportedPlatformId(id: PlatformId): boolean {
    return id !== 'unknown';
}
