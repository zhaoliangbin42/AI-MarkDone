import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { copyMarkdownFromPage } from '@/services/copy/copy-markdown';

describe('copyMarkdownFromPage (ChatGPT)', () => {
    it('extracts current code-viewer blocks as fenced markdown without leaking header chrome', () => {
        const html = readFileSync('mocks/ChatGPT/ChatGPT-deepresearch.html', 'utf-8');
        document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

        const adapter = new ChatGPTAdapter();
        const res = copyMarkdownFromPage(adapter);
        expect(res.ok).toBe(true);
        if (!res.ok) return;

        expect(res.markdown).toContain('```latex');
        expect(res.markdown).toContain('Against this background');
        expect(res.markdown).not.toContain('LaTeXAgainst this background');
        expect(res.markdown).not.toContain('CopyAgainst this background');
    }, 20_000);
});
