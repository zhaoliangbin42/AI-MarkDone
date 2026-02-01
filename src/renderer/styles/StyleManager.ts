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
    private static readonly CDN_TIMEOUT = 3000;
    private static readonly KATEX_CDN_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';

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

        // 1) Inject bundled KaTeX (non-blocking)
        const t0 = performance.now();
        await this.injectBundledKatex(target);
        logger.debug(`[AI-MarkDone][StyleManager] injectBundledKatex: ${(performance.now() - t0).toFixed(2)}ms`);

        // 2) Load CDN in the background (best-effort)
        this.loadKatexCDN(target).catch(() => {
            logger.warn('[AI-MarkDone][StyleManager] CDN load failed, using bundled');
        });

        // 3. Inject base markdown styles
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

    /**
     * Load KaTeX CDN (with timeout)
     */
    private static loadKatexCDN(target: Document | ShadowRoot): Promise<void> {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.id = 'katex-styles';
            link.rel = 'stylesheet';
            link.href = this.KATEX_CDN_URL;
            link.crossOrigin = 'anonymous';

            const timeout = setTimeout(() => {
                link.remove();
                reject(new Error('CDN_TIMEOUT'));
            }, this.CDN_TIMEOUT);

            link.onload = () => {
                clearTimeout(timeout);
                resolve();
            };

            link.onerror = () => {
                clearTimeout(timeout);
                link.remove();
                reject(new Error('CDN_LOAD_FAILED'));
            };

            target.appendChild(link);
        });
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
