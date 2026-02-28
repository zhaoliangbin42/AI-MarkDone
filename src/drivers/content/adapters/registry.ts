import { detectPlatformId } from '../../../contracts/platform';
import { ChatGPTAdapter } from './sites/chatgpt';
import { GeminiAdapter } from './sites/gemini';
import { ClaudeAdapter } from './sites/claude';
import { DeepseekAdapter } from './sites/deepseek';
import type { SiteAdapter } from './base';

const adapters: SiteAdapter[] = [
    new ChatGPTAdapter(),
    new GeminiAdapter(),
    new ClaudeAdapter(),
    new DeepseekAdapter(),
];

export function getAdapter(url: string = window.location.href): SiteAdapter | null {
    for (const adapter of adapters) {
        if (adapter.matches(url)) return adapter;
    }

    // Fallback: hostname detection can still provide platform id for UI display.
    const hostname = (() => {
        try { return new URL(url).hostname; } catch { return ''; }
    })();
    const id = detectPlatformId(hostname);
    return id === 'unknown' ? null : null;
}

