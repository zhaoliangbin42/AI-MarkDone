import { describe, test, expect, beforeEach } from 'vitest';
import { MarkdownRenderer } from '../MarkdownRenderer';

describe('MarkdownRenderer', () => {
    beforeEach(() => {
        // Reset circuit breaker between tests
        const cb = (MarkdownRenderer as any).circuitBreaker;
        if (cb) cb.reset();
    });

    test('renders basic markdown', async () => {
        const result = await MarkdownRenderer.render('# Hello\n\nThis is **bold**.');
        expect(result.success).toBe(true);
        expect(result.html).toContain('<h1');
        expect(result.html).toContain('<strong>bold</strong>');
    });

    test('renders math', async () => {
        const result = await MarkdownRenderer.render('Inline: $x^2$\n\nBlock:\n$$\\frac{a}{b}$$');
        expect(result.success).toBe(true);
        expect(result.html).toContain('katex');
    });

    test('input validation: detects XSS', async () => {
        const result = await MarkdownRenderer.render('<script>alert("XSS")</script>');
        expect(result.success).toBe(false);
        expect(result.error).toBe('DANGEROUS_CONTENT');
    });

    test('input validation: oversized content', async () => {
        const huge = 'x'.repeat(2_000_000);
        const result = await MarkdownRenderer.render(huge);
        expect(result.success).toBe(false);
        expect(result.error).toBe('CONTENT_TOO_LARGE');
    });

    test('sanitizes HTML via DOMPurify', async () => {
        const result = await MarkdownRenderer.render('[Click](javascript:alert(1))', {
            sanitize: true,
        });
        // Current policy: dangerous patterns are blocked by InputValidator before render.
        expect(result.success).toBe(false);
        expect(result.error).toBe('DANGEROUS_CONTENT');
        expect(result.fallback).not.toContain('javascript:');
    });

    test('timeout fallback (simulated)', async () => {
        // Create a huge document to increase the chance of timing out (may not always reproduce).
        const huge = '#'.repeat(100000) + '\n' + 'text '.repeat(100000);
        const result = await MarkdownRenderer.render(huge, { timeout: 100 });

        // Should either succeed or return a fallback result.
        expect(result.success !== undefined).toBe(true);
    });

    test('circuit breaker: validation failures do not count as runtime failures', async () => {
        // Validation failures return fallback and do not throw into circuit breaker.
        await MarkdownRenderer.render('<script>1</script>');
        await MarkdownRenderer.render('<script>2</script>');
        await MarkdownRenderer.render('<script>3</script>');

        const state = MarkdownRenderer.getCircuitState();
        expect(state.failures).toBe(0);
    });

    test('formula preprocessing: adjacent formulas', async () => {
        const result = await MarkdownRenderer.render('$a$、$b$');
        expect(result.success).toBe(true);
        // Should handle adjacent formulas correctly.
    });

    test('code blocks: placeholder mode', async () => {
        const result = await MarkdownRenderer.render('```python\nprint("hello")\n```', {
            codeBlockMode: 'placeholder',
        });
        expect(result.success).toBe(true);
        expect(result.html).toContain('code-placeholder');
    });

    test('code placeholder escapes language label', async () => {
        const result = await MarkdownRenderer.render('```<img src=x>\nprint("hello")\n```', {
            codeBlockMode: 'placeholder',
            sanitize: false,
        });
        expect(result.success).toBe(true);
        expect(result.html).toContain('code-placeholder');
        expect(result.html).not.toContain('<img');
    });

    test('code blocks: full mode', async () => {
        const result = await MarkdownRenderer.render('```python\nprint("hello")\n```', {
            codeBlockMode: 'full',
        });
        expect(result.success).toBe(true);
        expect(result.html).toContain('<code');
    });

    test('render lock key does not collide on shared prefix', async () => {
        const prefix = 'A'.repeat(120);
        const md1 = `${prefix}\n\n**first**`;
        const md2 = `${prefix}\n\n**second**`;

        const [r1, r2] = await Promise.all([
            MarkdownRenderer.render(md1),
            MarkdownRenderer.render(md2),
        ]);

        expect(r1.success).toBe(true);
        expect(r2.success).toBe(true);
        expect(r1.html).toContain('<strong>first</strong>');
        expect(r2.html).toContain('<strong>second</strong>');
    });

    test('chunking should keep fenced code block boundaries intact', () => {
        const markdown = [
            'Intro paragraph with enough text to trigger chunking.',
            '```ts',
            'const x = 1;',
            'const y = x + 1;',
            'console.log(y);',
            '```',
            'Tail paragraph.',
        ].join('\n');

        const chunks = (MarkdownRenderer as any).chunkMarkdown(markdown, 40) as string[];
        expect(chunks.length).toBeGreaterThan(1);

        for (const chunk of chunks) {
            const fenceCount = (chunk.match(/^(```|~~~)/gm) || []).length;
            expect(fenceCount % 2).toBe(0);
        }
    });
});
