import { BUNDLED_KATEX_CSS } from './bundled-katex.css';
import { logger } from '../../utils/logger';

export interface StyleResult {
    success: boolean;
    usedFallback: boolean;
    error?: string;
}

/**
 * Style manager with CDN fallback and user notification
 */
export class StyleManager {
    private static injectedTargets = new WeakSet<Document | ShadowRoot>();
    private static injectedCount = 0;
    private static readonly KATEX_LOCAL_CSS_PATH = 'vendor/katex/katex.min.css';
    private static readonly LOCAL_CSS_FALLBACK_DELAY_MS = 800;

    /**
     * Inject styles (with CDN fallback)
     */
    static async injectStyles(
        target: Document | ShadowRoot
    ): Promise<StyleResult> {
        const styleStartTime = performance.now();
        logger.debug('[AI-MarkDone][StyleManager] START injectStyles');

        if (this.injectedTargets.has(target)) {
            logger.debug('[AI-MarkDone][StyleManager] Already injected (cached)');
            return { success: true, usedFallback: false };
        }

        // 1) Inject bundled KaTeX immediately to avoid blocking UI on stylesheet load events.
        // Why: <link rel="stylesheet"> load/onerror can be unreliable in some ShadowRoot contexts; awaiting it can hang rendering.
        const t0 = performance.now();
        await this.injectBundledKatex(target);
        this.injectLocalKatexBestEffort(target);
        logger.debug(`[AI-MarkDone][StyleManager] injectKatexStyles: ${(performance.now() - t0).toFixed(2)}ms`);

        // 2. Inject base markdown styles
        const t1 = performance.now();
        const mdStyle = document.createElement('style');
        mdStyle.id = 'aicopy-markdown-styles';
        mdStyle.textContent = this.getMarkdownStyles();
        target.appendChild(mdStyle);
        logger.debug(`[AI-MarkDone][StyleManager] injectBaseStyles: ${(performance.now() - t1).toFixed(2)}ms`);

        this.injectedTargets.add(target);
        this.injectedCount++;

        const styleEndTime = performance.now();
        logger.debug(`[AI-MarkDone][StyleManager] END injectStyles: ${(styleEndTime - styleStartTime).toFixed(2)}ms`);
        return { success: true, usedFallback: false };
    }

    private static injectLocalKatexBestEffort(target: Document | ShadowRoot): void {
        try {
            const runtime = (globalThis as any).chrome?.runtime || (globalThis as any).browser?.runtime;
            const getURL: ((path: string) => string) | undefined = runtime?.getURL?.bind(runtime);

            if (!getURL) {
                logger.warn('[AI-MarkDone][StyleManager] runtime.getURL not available; falling back to bundled KaTeX CSS');
                return;
            }

            const href = getURL(this.KATEX_LOCAL_CSS_PATH);

            const existing = (target as any).querySelector?.('link#aicopy-katex-styles') as HTMLLinkElement | null;
            if (existing) {
                return;
            }

            const link = document.createElement('link');
            link.id = 'aicopy-katex-styles';
            link.rel = 'stylesheet';
            link.href = href;

            const fallbackTimer = setTimeout(() => {
                logger.warn('[AI-MarkDone][StyleManager] Local KaTeX CSS load timed out; keeping bundled CSS');
            }, this.LOCAL_CSS_FALLBACK_DELAY_MS);

            link.onload = () => {
                clearTimeout(fallbackTimer);
                logger.debug('[AI-MarkDone][StyleManager] Local KaTeX CSS loaded');
            };
            link.onerror = () => {
                clearTimeout(fallbackTimer);
                link.remove();
                logger.warn('[AI-MarkDone][StyleManager] Failed to load local KaTeX CSS; falling back to bundled CSS');
            };

            target.appendChild(link);
        } catch (error) {
            logger.warn('[AI-MarkDone][StyleManager] Local KaTeX CSS injection error; keeping bundled CSS', error);
        }
    }

    /**
     * Inject bundled KaTeX (fallback)
     */
    private static async injectBundledKatex(target: Document | ShadowRoot): Promise<void> {
        const style = document.createElement('style');
        style.id = 'katex-styles-bundled';
        style.textContent = BUNDLED_KATEX_CSS;
        target.appendChild(style);
    }

    /**
     * Get markdown styles (with formula alignment fix)
     */
    static getMarkdownStyles(): string {
        return `
      .markdown-body {
        --fgColor-default: var(--aimd-text-primary);
        --fgColor-muted: var(--aimd-text-secondary);
        --fgColor-accent: var(--aimd-text-link);
        --bgColor-default: var(--aimd-bg-primary);
        --bgColor-muted: var(--aimd-bg-secondary);
        --borderColor-default: var(--aimd-border-default);
        
        margin: 0;
        padding: 12px 16px;
        color: var(--fgColor-default);
        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size: 16px;
        line-height: 1.6;
        word-wrap: break-word;
      }

      /* Code placeholder styles */
      .markdown-body .code-placeholder {
        background: var(--bgColor-muted);
        border: 1px solid var(--borderColor-default);
        border-radius: 6px;
        padding: 12px;
        margin: 1em 0;
        text-align: center;
      }

      .markdown-body .code-placeholder-header {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: var(--fgColor-muted);
        margin-bottom: 8px;
      }

      .markdown-body .code-placeholder-icon {
        font-size: 48px;
        opacity: 0.5;
      }

      /* Other markdown styles */
      .markdown-body h1, .markdown-body h2 {
        border-bottom: 1px solid var(--borderColor-default);
        padding-bottom: 0.3em;
      }

      .markdown-body code {
        background: var(--bgColor-muted);
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: ui-monospace, monospace;
        font-size: 85%;
      }

      .markdown-body pre {
        background: var(--bgColor-muted);
        padding: 16px;
        border-radius: 6px;
        overflow: auto;
      }

      .markdown-body table {
        border-collapse: collapse;
        width: 100%;
      }

      .markdown-body th, .markdown-body td {
        border: 1px solid var(--borderColor-default);
        padding: 6px 13px;
      }

      .markdown-body blockquote {
        border-left: 4px solid var(--borderColor-default);
        padding-left: 16px;
        color: var(--fgColor-muted);
      }

      .markdown-fallback {
        background: var(--bgColor-muted);
        padding: 16px;
        border-radius: 6px;
        color: var(--fgColor-default);
        font-family: ui-monospace, monospace;
        font-size: 14px;
        white-space: pre-wrap;
      }
    `;
    }

    // Health check
    static getInjectedCount(): number {
        return this.injectedCount;
    }

    static reset(): void {
        this.injectedCount = 0;
    }
}
