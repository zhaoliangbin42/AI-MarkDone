/**
 * Parser Platform Adapter Registry
 * 
 * Extensible registry for platform-specific parser adapters.
 * Similar to content/adapters/registry.ts but for the Parser layer.
 * 
 * To add a new platform:
 * 1. Create a new adapter implementing IPlatformAdapter
 * 2. Register it in this file with a URL pattern
 */

import type { IPlatformAdapter } from './IPlatformAdapter';
import { ChatGPTAdapter } from './ChatGPTAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';

interface AdapterRegistration {
    /** URL patterns to match (substring match) */
    patterns: string[];
    /** Factory function to create adapter */
    create: () => IPlatformAdapter;
}

/**
 * Platform adapter registry for Parser
 */
class ParserAdapterRegistry {
    private registrations: AdapterRegistration[] = [];
    private defaultAdapter: () => IPlatformAdapter = () => new ChatGPTAdapter();

    constructor() {
        // Register built-in adapters
        this.registerBuiltIn();
    }

    /**
     * Register built-in platform adapters
     */
    private registerBuiltIn(): void {
        // Gemini
        this.register({
            patterns: ['gemini.google.com'],
            create: () => new GeminiAdapter(),
        });

        // ChatGPT (multiple domains)
        this.register({
            patterns: ['chatgpt.com', 'chat.openai.com'],
            create: () => new ChatGPTAdapter(),
        });

        // Claude.ai
        this.register({
            patterns: ['claude.ai'],
            create: () => new ClaudeAdapter(),
        });
    }

    /**
     * Register a new adapter with URL patterns
     */
    register(registration: AdapterRegistration): void {
        this.registrations.push(registration);
    }

    /**
     * Set the default adapter factory (used when no pattern matches)
     */
    setDefault(factory: () => IPlatformAdapter): void {
        this.defaultAdapter = factory;
    }

    /**
     * Get adapter for current platform
     * 
     * @param hostname - Optional hostname override (for testing)
     */
    getAdapter(hostname?: string): IPlatformAdapter {
        const host = hostname ?? this.getHostname();

        if (!host) {
            console.log('[ParserAdapterRegistry] No hostname - using default adapter');
            return this.defaultAdapter();
        }

        const hostLower = host.toLowerCase();

        for (const reg of this.registrations) {
            for (const pattern of reg.patterns) {
                if (hostLower.includes(pattern)) {
                    const adapter = reg.create();
                    console.log(`[ParserAdapterRegistry] Platform detected: ${adapter.name}`);
                    return adapter;
                }
            }
        }

        console.log('[ParserAdapterRegistry] No matching platform - using default');
        return this.defaultAdapter();
    }

    /**
     * Get current hostname (browser only)
     */
    private getHostname(): string | null {
        if (typeof window === 'undefined' || !window.location) {
            return null;
        }
        return window.location.hostname;
    }

    /**
     * List all registered patterns (for debugging)
     */
    getRegisteredPatterns(): string[] {
        return this.registrations.flatMap(r => r.patterns);
    }
}

// Export singleton instance
export const parserAdapterRegistry = new ParserAdapterRegistry();
