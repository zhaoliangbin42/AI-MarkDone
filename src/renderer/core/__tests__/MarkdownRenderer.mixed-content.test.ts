import { describe, expect, test } from 'vitest';
import { MarkdownRenderer } from '../MarkdownRenderer';

describe('MarkdownRenderer mixed-content regression', () => {
    test('renders markdown + math + code in full mode', async () => {
        const markdown = [
            '# Mixed Content',
            '',
            'Inline math: $x^2 + 1$',
            '',
            'Block math:',
            '$$\\frac{a}{b}$$',
            '',
            '```ts',
            'const answer = 42;',
            '```',
        ].join('\n');

        const result = await MarkdownRenderer.render(markdown, { codeBlockMode: 'full' });
        expect(result.success).toBe(true);
        expect(result.html).toContain('<h1');
        expect(result.html).toContain('katex');
        expect(result.html).toContain('<code');
    });

    test('renders code placeholder in placeholder mode for mixed content', async () => {
        const markdown = [
            'Math: $a+b$',
            '',
            '```python',
            'print("hi")',
            '```',
        ].join('\n');

        const result = await MarkdownRenderer.render(markdown, { codeBlockMode: 'placeholder' });
        expect(result.success).toBe(true);
        expect(result.html).toContain('katex');
        expect(result.html).toContain('code-placeholder');
    });

    test('rejects dangerous content before rendering', async () => {
        const markdown = [
            '# Dangerous Input',
            '',
            '[x](javascript:alert(1))',
            '',
            '```js',
            'console.log("safe code block")',
            '```',
        ].join('\n');

        const result = await MarkdownRenderer.render(markdown, { codeBlockMode: 'full' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('DANGEROUS_CONTENT');
        expect(result.fallback).not.toContain('javascript:');
    });
});
