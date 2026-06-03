import { ChatGPTAdapter } from './sites/chatgpt';
import type { SiteAdapter } from './base';

const adapters: SiteAdapter[] = [
    new ChatGPTAdapter(),
];

export function getAdapter(url: string = window.location.href): SiteAdapter | null {
    for (const adapter of adapters) {
        if (adapter.matches(url)) return adapter;
    }

    return null;
}
