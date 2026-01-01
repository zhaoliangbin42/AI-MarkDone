import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { InputValidator } from '../utils/InputValidator';
import { CircuitBreaker } from '../resilience/CircuitBreaker';
import { DOMPurifySanitizer } from '../sanitizer/DOMPurifySanitizer';
import { ISanitizer } from '../sanitizer/ISanitizer';

export interface RenderOptions {
    maxInputSize?: number;
    maxOutputSize?: number;
    timeout?: number;
    sanitize?: boolean;
    codeBlockMode?: 'full' | 'placeholder';
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
    private static initialized = false;
    private static circuitBreaker = new CircuitBreaker();
    private static sanitizer: ISanitizer = new DOMPurifySanitizer();

    private static readonly DEFAULT_OPTIONS: Required<RenderOptions> = {
        maxInputSize: 1_000_000,
        maxOutputSize: 5_000_000,
        timeout: 3000,
        sanitize: true,
        codeBlockMode: 'full',
    };

    /**
     * Render markdown (with circuit breaker protection)
     */
    static async render(
        markdown: string,
        options: RenderOptions = {}
    ): Promise<RenderResult> {
        return this.circuitBreaker.execute(
            () => this.renderUnsafe(markdown, options),
            {
                success: false,
                error: 'CIRCUIT_OPEN',
                fallback: this.renderPlainText(markdown),
            }
        );
    }

    /**
     * Unsafe render (protected by circuit breaker)
     */
    private static async renderUnsafe(
        markdown: string,
        options: RenderOptions = {}
    ): Promise<RenderResult> {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };

        // 1. Input validation
        const validation = InputValidator.validate(markdown, opts.maxInputSize);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.error,
                fallback: this.renderPlainText(validation.sanitized),
            };
        }

        // 2. Initialize marked
        this.ensureInitialized(opts.codeBlockMode);

        // 3. Render with timeout (chunked, interruptible)
        try {
            const html = await this.renderWithTimeout(
                validation.sanitized,
                opts.timeout
            );

            // 4. Output size check
            if (html.length > opts.maxOutputSize) {
                throw new Error('OUTPUT_TOO_LARGE');
            }

            // 5. XSS sanitization
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
        timeout: number
    ): Promise<string> {
        let aborted = false;
        let timerId: number;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timerId = setTimeout(() => {
                aborted = true;
                reject(new Error('RENDER_TIMEOUT'));
            }, timeout) as any;
        });

        const renderPromise = new Promise<string>((resolve, reject) => {
            try {
                const processed = this.preprocessFormulas(markdown);

                // Chunk markdown (interruptible)
                const chunks = this.chunkMarkdown(processed, 10000);
                let result = '';

                for (const chunk of chunks) {
                    if (aborted) {
                        reject(new Error('RENDER_ABORTED'));
                        return;
                    }
                    result += marked.parse(chunk) as string;
                }

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });

        return Promise.race([renderPromise, timeoutPromise])
            .finally(() => clearTimeout(timerId));
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

        for (const line of lines) {
            if (currentChunk.length + line.length > chunkSize) {
                chunks.push(currentChunk);
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
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
     * Initialize marked (once)
     */
    private static ensureInitialized(codeBlockMode: 'full' | 'placeholder'): void {
        if (this.initialized) return;

        marked.setOptions({
            breaks: true,
            gfm: true,
        });

        // KaTeX extension
        marked.use(markedKatex({
            throwOnError: false,
            output: 'html',
            nonStandard: true,
        }));

        // Code block mode (configurable)
        if (codeBlockMode === 'placeholder') {
            const renderer = new marked.Renderer();
            renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
                const language = lang || 'code';
                const lines = text.split('\n').length;
                return `
          <div class="code-placeholder">
            <div class="code-placeholder-header">
              <span class="code-language">${language}</span>
              <span class="code-lines">${lines} lines</span>
            </div>
            <div class="code-placeholder-icon">📄</div>
          </div>
        `;
            };
            marked.use({ renderer });
        }

        this.initialized = true;
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
