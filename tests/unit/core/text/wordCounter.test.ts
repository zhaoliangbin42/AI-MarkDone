import { describe, expect, it } from 'vitest';
import { normalizeChatGPTReaderMarkdown } from '@/drivers/content/chatgpt/normalizeReaderMarkdown';
import { WordCounter } from '../../../../src/core/text/wordCounter';

describe('WordCounter', () => {
    it('counts latin words and chars', () => {
        const counter = new WordCounter();
        const res = counter.count('hello world');
        expect(res.words).toBe(2);
        expect(res.chars).toBe(10);
        expect(res.cjk).toBe(0);
        expect(res.latin).toBe(2);
    });

    it('counts CJK as words and 2x chars', () => {
        const counter = new WordCounter();
        const res = counter.count('你好');
        expect(res.words).toBe(2);
        expect(res.chars).toBe(4);
        expect(res.cjk).toBe(2);
        expect(res.latin).toBe(0);
    });

    it('excludes fenced code blocks and treats code-only as 0/0', () => {
        const counter = new WordCounter();
        const res = counter.count('```js\nconst a = 1;\n```');
        expect(res.words).toBe(0);
        expect(res.chars).toBe(0);
        expect(res.excluded.codeBlocks).toBe(1);
        expect(counter.format(res)).toBe('0 Words / 0 Chars');
    });

    it('excludes math formulas from counting', () => {
        const counter = new WordCounter();
        const res = counter.count('$a+b$ 你好');
        expect(res.words).toBe(2);
        expect(res.cjk).toBe(2);
        expect(res.excluded.mathFormulas).toBe(1);
    });

    it('excludes normalized same-line double-dollar formulas from counting', () => {
        const counter = new WordCounter();
        const markdown = normalizeChatGPTReaderMarkdown('这里的 $$a_j$$ 就是矩阵 $$A$$。');
        const res = counter.count(markdown);

        expect(markdown).toBe('这里的 $a_j$ 就是矩阵 $A$。');
        expect(res.words).toBe(7);
        expect(res.excluded.mathFormulas).toBe(2);
    });

    it('excludes display math formulas from counting', () => {
        const counter = new WordCounter();
        const markdown = normalizeChatGPTReaderMarkdown('公式：\n\\[\nx^2\n\\]\n\n你好');
        const res = counter.count(markdown);

        expect(markdown).toContain('$$\nx^2\n$$');
        expect(res.words).toBe(4);
        expect(res.excluded.mathFormulas).toBe(1);
    });

    it('excludes inline code', () => {
        const counter = new WordCounter();
        const res = counter.count('Hi `code` there');
        expect(res.words).toBe(2);
        expect(res.latin).toBe(2);
    });
});
