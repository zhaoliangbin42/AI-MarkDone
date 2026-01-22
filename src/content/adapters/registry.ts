import { SiteAdapter } from './base';
import { ChatGPTAdapter } from './chatgpt';
import { GeminiAdapter } from './gemini';
import { ClaudeAdapter } from './claude';
import { DeepseekAdapter } from './deepseek';

/**
 * Adapter registry for managing multiple platform adapters
 */
class AdapterRegistry {
    private adapters: SiteAdapter[] = [];
    private currentAdapter: SiteAdapter | null = null;

    constructor() {
        // Register all available adapters
        this.register(new ChatGPTAdapter());
        this.register(new GeminiAdapter());
        this.register(new ClaudeAdapter());
        this.register(new DeepseekAdapter());
    }

    /**
     * Register a new adapter
     */
    register(adapter: SiteAdapter): void {
        this.adapters.push(adapter);
    }

    /**
     * Get the appropriate adapter for current URL
     */
    getAdapter(url: string = window.location.href): SiteAdapter | null {
        if (this.currentAdapter && this.currentAdapter.matches(url)) {
            return this.currentAdapter;
        }

        for (const adapter of this.adapters) {
            if (adapter.matches(url)) {
                this.currentAdapter = adapter;
                return adapter;
            }
        }

        return null;
    }

    /**
     * Check if current page is supported
     */
    isSupported(url: string = window.location.href): boolean {
        return this.getAdapter(url) !== null;
    }

    /**
     * Get all registered adapters
     * Used for fallback theme detection when current adapter is unknown
     */
    getAllAdapters(): SiteAdapter[] {
        return [...this.adapters];
    }
}

// Export singleton instance
export const adapterRegistry = new AdapterRegistry();
