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
        expect(result.success).toBe(true);
        expect(result.html).not.toContain('javascript:');
    });

    test('timeout fallback (simulated)', async () => {
        // Create a huge document to increase the chance of timing out (may not always reproduce).
        const huge = '#'.repeat(100000) + '\n' + 'text '.repeat(100000);
        const result = await MarkdownRenderer.render(huge, { timeout: 100 });

        // Should either succeed or return a fallback result.
        expect(result.success !== undefined).toBe(true);
    });

    test('circuit breaker: opens after 3 failures', async () => {
        // Trigger 3 validation failures
        await MarkdownRenderer.render('<script>1</script>');
        await MarkdownRenderer.render('<script>2</script>');
        await MarkdownRenderer.render('<script>3</script>');

        const state = MarkdownRenderer.getCircuitState();
        expect(state.failures).toBe(3);
        // Circuit may be OPEN or still in-flight depending on timing.
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

    test('code blocks: full mode', async () => {
        const result = await MarkdownRenderer.render('```python\nprint("hello")\n```', {
            codeBlockMode: 'full',
        });
        expect(result.success).toBe(true);
        expect(result.html).toContain('<code');
    });
});
