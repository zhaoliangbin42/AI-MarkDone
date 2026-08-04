import { isChatGPTPageHostname } from './chatgptHosts';

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
    if (isChatGPTPageHostname(hostname)) return 'chatgpt';
    return 'unknown';
}

export function isSupportedPlatformId(id: PlatformId): boolean {
    return id !== 'unknown';
}
