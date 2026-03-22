import { describe, expect, it } from 'vitest';
import { GeminiAdapter } from '@/drivers/content/adapters/sites/gemini';

describe('GeminiAdapter Deep Research retirement', () => {
    it('does not expose Deep Research compatibility hooks on the public adapter contract', () => {
        const adapter = new GeminiAdapter() as Record<string, unknown>;

        expect('isDeepResearchMessage' in adapter).toBe(false);
        expect('getDeepResearchContent' in adapter).toBe(false);
    });
});
