import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { InputValidator } from '../utils/InputValidator';
import { CircuitBreaker } from '../resilience/CircuitBreaker';
import { DOMPurifySanitizer } from '../sanitizer/DOMPurifySanitizer';
import { ISanitizer } from '../sanitizer/ISanitizer';
import { logger } from '../../utils/logger';

export interface RenderOptions {
    maxInputSize?: number;
    maxOutputSize?: number;
    timeout?: number;
    sanitize?: boolean;
    codeBlockMode?: 'full' | 'placeholder';
    onProgress?: (percent: number) => void;
}

export interface RenderResult {
    success: boolean;
    html?: string;
    error?: string;
    fallback?: string;
}

/**
 * Battle-hardened Markdown renderer
 * Features: circuit breaker, chunked rendering, input validation, XSS protection
 */
export class MarkdownRenderer {
    private static circuitBreaker = new CircuitBreaker();
    private static sanitizer: ISanitizer = new DOMPurifySanitizer();
    private static renderLock = new Map<string, Promise<RenderResult>>();

    private static readonly DEFAULT_OPTIONS: Required<RenderOptions> = {
        maxInputSize: 1_000_000,
        maxOutputSize: 5_000_000,
        timeout: 3000,
        sanitize: true,
        codeBlockMode: 'full',
        onProgress: undefined as any,
    };

    private static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private static buildRenderKey(markdown: string, options: RenderOptions): string {
        const optionsKey = JSON.stringify({
            timeout: options.timeout,
            sanitize: options.sanitize,
            codeBlockMode: options.codeBlockMode,
            maxInputSize: options.maxInputSize,
            maxOutputSize: options.maxOutputSize,
        });

        // FNV-1a 32-bit hash for stable lightweight keying.
        let hash = 0x811c9dc5;
        const text = `${optionsKey}|${markdown}`;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }

        return `${text.length}:${(hash >>> 0).toString(16)}`;
    }

    private static applyCodeBlockMode(markdown: string, mode: RenderOptions['codeBlockMode']): string {
        if (mode !== 'placeholder') {
            return markdown;
        }

        // Replace fenced code blocks with a stable placeholder to reduce render cost/noise.
        return markdown.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_match, langRaw: string, codeRaw: string) => {
            const lang = this.escapeHtml(String(langRaw || '').trim() || 'text');
            const lines = String(codeRaw || '').split('\n').filter(Boolean).length;
            return `<div class="code-placeholder">[Code block hidden: ${lang}, ${lines} lines]</div>`;
        });
    }

    /**
     * Create marked instance (per-render isolation)
     */
    private static createMarkedInstance(): Marked {
        const instance = new Marked();
        instance.setOptions({
            breaks: true,
            gfm: true,
            async: true,
        });
        instance.use(markedKatex({
            throwOnError: false,
            output: 'html',
            nonStandard: true,
        }));
        return instance;
    }

    /**
     * Render markdown (with circuit breaker + dedup)
     */
    static async render(
        markdown: string,
        options: RenderOptions = {}
    ): Promise<RenderResult> {
        const key = this.buildRenderKey(markdown, options);

        if (this.renderLock.has(key)) {
            return this.renderLock.get(key)!;
        }

        const markedInstance = this.createMarkedInstance();
        const promise = this.circuitBreaker.execute(
            () => this.renderUnsafe(markdown, options, markedInstance),
            {
                success: false,
                error: 'CIRCUIT_OPEN',
                fallback: this.renderPlainText(markdown),
            }
        );

        this.renderLock.set(key, promise);

        try {
            const result = await promise;
            return result;
        } finally {
            this.renderLock.delete(key);
        }
    }

    /**
     * Unsafe render (protected by circuit breaker)
     */
    private static async renderUnsafe(
        markdown: string,
        options: RenderOptions = {},
        markedInstance: Marked
    ): Promise<RenderResult> {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };

        // 1. Input validation
        const validation = InputValidator.validate(markdown, opts.maxInputSize);

        if (!validation.valid) {
            logger.warn(`[AI-MarkDone][Renderer] Validation failed: ${validation.error}`);
            return {
                success: false,
                error: validation.error,
                fallback: this.renderPlainText(validation.sanitized),
            };
        }

        // 2. Render with timeout (chunked, interruptible)
        try {
            const contentForRender = this.applyCodeBlockMode(validation.sanitized, opts.codeBlockMode);
            const html = await this.renderWithTimeout(
                contentForRender,
                opts.timeout,
                markedInstance,
                opts.onProgress
            );


            // 3. Output size check
            if (html.length > opts.maxOutputSize) {
                logger.error(`[AI-MarkDone][Renderer] OUTPUT_TOO_LARGE: ${html.length} > ${opts.maxOutputSize}`);
                throw new Error('OUTPUT_TOO_LARGE');
            }

            // 4. XSS sanitization
            const safeHtml = opts.sanitize
                ? this.sanitizer.sanitize(html)
                : html;

            return { success: true, html: safeHtml };

        } catch (error) {
            throw error; // Circuit breaker will catch
        }
    }

    /**
     * Render with timeout (chunked, interruptible)
     */
    private static renderWithTimeout(
        markdown: string,
        timeout: number,
        markedInstance: Marked,
        onProgress?: (percent: number) => void
    ): Promise<string> {
        const overallStart = Date.now();

        return new Promise((resolve, reject) => {
            const processed = this.preprocessFormulas(markdown);
            const chunks = this.chunkMarkdown(processed, 20000);

            let result = '';
            let currentIndex = 0;

            const processChunk = async () => {
                try {
                    if (currentIndex >= chunks.length) {
                        resolve(result);
                        return;
                    }

                    if (Date.now() - overallStart > timeout) {
                        logger.error(`[AI-MarkDone][Renderer] RENDER_TIMEOUT after ${Date.now() - overallStart}ms`);
                        reject(new Error('RENDER_TIMEOUT'));
                        return;
                    }

                    result += await markedInstance.parse(chunks[currentIndex]);

                    currentIndex++;

                        if (onProgress && currentIndex <= chunks.length) {
                            try {
                                onProgress((currentIndex / chunks.length) * 100);
                            } catch (e) {
                                logger.warn('[AI-MarkDone][Renderer] Progress callback error:', e);
                            }
                        }

                    if (currentIndex < chunks.length) {
                        await new Promise<void>(r => { queueMicrotask(() => r()); });
                        processChunk();
                    } else {
                        resolve(result);
                    }
                } catch (error) {
                    logger.error('[AI-MarkDone][Renderer] Chunk processing error:', error);
                    reject(error);
                }
            };

            processChunk();
        });
    }

    /**
     * Chunk markdown by lines (avoid breaking structure)
     */
    private static chunkMarkdown(markdown: string, chunkSize: number): string[] {
        if (markdown.length <= chunkSize) {
            return [markdown];
        }

        const lines = markdown.split('\n');
        const chunks: string[] = [];
        let currentChunk = '';
        let inFencedCodeBlock = false;

        for (const line of lines) {
            const wasInFencedCodeBlock = inFencedCodeBlock;
            const trimmed = line.trimStart();
            const isFenceLine = trimmed.startsWith('```') || trimmed.startsWith('~~~');

            const lineWithNewline = line + '\n';
            const wouldExceed = currentChunk.length + lineWithNewline.length > chunkSize;
            const isFenceSensitiveLine = wasInFencedCodeBlock || isFenceLine;

            // Keep fenced code blocks intact within a single chunk.
            // Why: per-chunk markdown parsing loses fence context when blocks are split.
            if (wouldExceed && !isFenceSensitiveLine && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = lineWithNewline;
            } else {
                currentChunk += lineWithNewline;
            }

            if (isFenceLine) {
                inFencedCodeBlock = !inFencedCodeBlock;
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    /**
     * Preprocess formulas (fix consecutive formulas)
     */
    private static preprocessFormulas(markdown: string): string {
        return markdown
            .replace(/\$([^$]+)\$([\u3001\uff0c\u3002\uff1b\uff1a\uff01\uff1f])\$([^$]+)\$/g,
                '$$$1$$ $2 $$$3$$')
            .replace(/\$([^$]+)\$(\u2014\u2014)\$([^$]+)\$/g,
                '$$$1$$ $2 $$$3$$');
    }

    /**
     * Fallback: render as plain text
     */
    private static renderPlainText(markdown: string): string {
        const escaped = markdown
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return `<pre class="markdown-fallback">${escaped}</pre>`;
    }

    /**
     * Set custom sanitizer (for testing)
     */
    static setSanitizer(sanitizer: ISanitizer): void {
        this.sanitizer = sanitizer;
    }

    /**
     * Get circuit breaker state (health check)
     */
    static getCircuitState(): { state: string; failures: number } {
        return this.circuitBreaker.getState();
    }
}
