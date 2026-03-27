import type { SiteAdapter } from '../adapters/base';

function isChatGPTConversationPage(url: string): boolean {
    try {
        const parsed = new URL(url);
        return (parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.openai.com') && /^\/c\//.test(parsed.pathname);
    } catch {
        return false;
    }
}

export class ChatGPTEarlyLoadGuard {
    private adapter: SiteAdapter;
    private activated = false;

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    async init(): Promise<void> {
        if (this.activated) return;
        if (this.adapter.getPlatformId() !== 'chatgpt') return;
        if (!isChatGPTConversationPage(window.location.href)) return;
        // The early-prune experiment is intentionally out of the default product path.
        // Keep this stub as a non-shipping draft entrypoint only.
        return;
    }
}
