import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { copyMarkdownFromPage } from '@/services/copy/copy-markdown';

describe('copyMarkdownFromPage (ChatGPT)', () => {
    it('converts a real fixture to markdown (baseline signals)', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-Code.html', 'utf-8');
        document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

        const adapter = new ChatGPTAdapter();
        const res = copyMarkdownFromPage(adapter);
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        expect(res.markdown).toContain('```ts');
        expect(res.markdown).toContain('TypeScript');
        expect(res.markdown).toContain('---');
    });
});

