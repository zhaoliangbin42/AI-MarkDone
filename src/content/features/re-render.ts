import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';

/**
 * Panel overlay styles - Notion-inspired, using design tokens
 */
const panelStyles = `
.aicopy-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 15, 15, 0.6);
  z-index: 999998;
  backdrop-filter: blur(8px);
}

.aicopy-panel {
  position: fixed;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 900px;
  height: 80vh;
  background: white;
  border-radius: 16px;
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.12),
    0 16px 48px rgba(0, 0, 0, 0.18),
    0 24px 80px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  z-index: 999999;
  overflow: hidden;
  animation: modalFadeIn 0.2s ease;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.aicopy-panel-fullscreen {
  top: 0 !important;
  left: 0 !important;
  transform: none !important;
  width: 100vw !important;
  max-width: none !important;
  height: 100vh !important;
  border-radius: 0 !important;
}

.aicopy-panel-header {
  padding: 8px 24px;
  border-bottom: 1px solid #E9E9E7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  flex-shrink: 0;
}

.aicopy-panel-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.aicopy-panel-title {
  font-size: 15px;
  font-weight: 600;
  color: #37352F;
  margin: 0;
  letter-spacing: -0.01em;
}

.aicopy-panel-fullscreen-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #6B7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.aicopy-panel-fullscreen-btn:hover {
  background: #F3F4F6;
  color: #1A1A1A;
}

.aicopy-panel-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #9B9A97;
  cursor: pointer;
  padding: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.aicopy-panel-close:hover {
  background: #EBEBEB;
  color: #37352F;
}

.aicopy-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 0px 32px;
  background: white;
}

.aicopy-panel-body .markdown-body {
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ============================================
   DARK MODE - Shadow DOM compatible
   ============================================ */

:host([data-theme='dark']) .aicopy-panel-overlay {
  background: rgba(0, 0, 0, 0.8);
}

:host([data-theme='dark']) .aicopy-panel {
  background: #1E1E1E;
  box-shadow: 
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.5),
    0 16px 48px rgba(0, 0, 0, 0.6),
    0 24px 80px rgba(0, 0, 0, 0.4);
}

:host([data-theme='dark']) .aicopy-panel-header {
  background: #1E1E1E;
  border-bottom-color: #3F3F46;
}

:host([data-theme='dark']) .aicopy-panel-title {
  color: #FFFFFF;
}

:host([data-theme='dark']) .aicopy-panel-fullscreen-btn {
  color: #A1A1AA;
}

:host([data-theme='dark']) .aicopy-panel-fullscreen-btn:hover {
  background: #27272A;
  color: #FFFFFF;
}

:host([data-theme='dark']) .aicopy-panel-close {
  color: #A1A1AA;
}

:host([data-theme='dark']) .aicopy-panel-close:hover {
  background: #27272A;
  color: #FFFFFF;
}

:host([data-theme='dark']) .aicopy-panel-body {
  background: #1E1E1E;
}
`;



/**
 * GitHub Markdown styles - Adapted for Extension
 */
const markdownStyles = `
.markdown-body {
  /* Light mode variables */
  --fgColor-default: #1f2328;
  --fgColor-muted: #59636e;
  --fgColor-accent: #0969da;
  --bgColor-default: #ffffff;
  --bgColor-muted: #f6f8fa;
  --bgColor-attention-muted: #fff8c5;
  --borderColor-default: #d1d9e0;
  --borderColor-muted: #d1d9e0b3;
  
  margin: 0;
  padding: 12px 16px;
  color: var(--fgColor-default);
  /* background-color: var(--bgColor-default); */
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;
  font-size: 16px;
  line-height: 1.6;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Headings */
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body h1 {
  margin: .67em 0;
  padding-bottom: .3em;
  font-size: 2em;
  border-bottom: 1px solid var(--borderColor-muted);
}

.markdown-body h2 {
  padding-bottom: .3em;
  font-size: 1.5em;
  border-bottom: 1px solid var(--borderColor-muted);
}

.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: .875em; }
.markdown-body h6 { font-size: .85em; color: var(--fgColor-muted); }

/* Paragraphs */
.markdown-body p { 
  margin-top: 0; 
  margin-bottom: 10px;
}

/* Links */
.markdown-body a { color: var(--fgColor-accent); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }

/* Strong and emphasis */
.markdown-body b, .markdown-body strong { font-weight: 600; }
.markdown-body em { font-style: italic; }

/* Blockquotes */
.markdown-body blockquote {
  margin: 0;
  padding: 0 1em;
  color: var(--fgColor-muted);
  border-left: .25em solid var(--borderColor-default);
}

/* Code */
.markdown-body code, .markdown-body kbd, .markdown-body pre {
  font-family: ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace;
}

.markdown-body code {
  padding: .2em .4em;
  margin: 0;
  font-size: 85%;
  white-space: break-spaces;
  background-color: var(--bgColor-muted);
  border-radius: 6px;
  border: 1px solid var(--borderColor-default);
}

.markdown-body pre {
  margin-top: 0;
  margin-bottom: 16px;
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: var(--bgColor-muted);
  border-radius: 6px;
  border: 1px solid var(--borderColor-default);
}

.markdown-body pre code {
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: 0;
}

/* Lists */
.markdown-body ul, .markdown-body ol {
  margin-top: 0;
  margin-bottom: 16px;
  padding-left: 2em;
}

.markdown-body li { margin-top: .25em; }
.markdown-body li + li { margin-top: .25em; }

/* Tables */
.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  display: block;
  width: max-content;
  max-width: 100%;
  overflow: auto;
}

.markdown-body td, .markdown-body th {
  padding: 6px 13px;
  border: 1px solid var(--borderColor-default);
}

.markdown-body th {
  font-weight: 600;
  background-color: var(--bgColor-muted);
}

.markdown-body tr {
  background-color: var(--bgColor-default);
  border-top: 1px solid var(--borderColor-muted);
}

.markdown-body tr:nth-child(2n) {
  background-color: var(--bgColor-muted);
}

/* Horizontal rule */
.markdown-body hr {
  height: .25em;
  padding: 0;
  margin: 24px 0;
  background-color: var(--borderColor-default);
  border: 0;
}

/* Images */
.markdown-body img {
  max-width: 100%;
  border-style: none;
}

/* Mark */
.markdown-body mark {
  background-color: var(--bgColor-attention-muted);
  color: var(--fgColor-default);
}

/* Task lists */
.markdown-body input[type="checkbox"] {
  margin: 0 .2em .25em -1.6em;
  vertical-align: middle;
}

/* KaTeX - Best practice from open-source projects */
.markdown-body .katex { 
  font-size: 1.1em;
  display: inline-block;
  text-indent: 0;
  text-rendering: auto;
  vertical-align: -0.25em;
}

.markdown-body .katex-display {
  display: block;
  margin: 1.5em 0;
  text-align: center;
  overflow-x: auto;
  overflow-y: hidden;
}

/* ============================================
   DARK MODE - GitHub Dark (Shadow DOM compatible)
   ============================================ */

:host([data-theme='dark']) .markdown-body {
  --fgColor-default: #f0f6fc;
  --fgColor-muted: #9198a1;
  --fgColor-accent: #4493f8;
  --bgColor-default: #212121;
  --bgColor-muted: #2d2d2d;
  --bgColor-attention-muted: #bb800926;
  --borderColor-default: #3d444d;
  --borderColor-muted: #3d444db3;
}
`;




/**
 * Re-render panel - direct DOM rendering, no iframe
 */
export class ReRenderPanel {
    private container: HTMLElement | null = null;
    private currentThemeIsDark: boolean = false;

    constructor() {
        // Configure marked with GitHub Flavored Markdown
        marked.setOptions({
            breaks: true,   // Convert \n to <br>
            gfm: true,      // GitHub Flavored Markdown
        });

        // Add KaTeX support with non-greedy matching
        marked.use(markedKatex({
            throwOnError: false,
            output: 'html',
            nonStandard: true  // Allow non-standard syntax
        }));

    }

    /**
     * Show panel with rendered Markdown
     */
    show(markdown: string): void {
        this.hide();
        this.createPanel(markdown);
    }

    /**
     * Hide panel
     */
    hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    /**
     * Apply theme to the panel host
     */
    setTheme(isDark: boolean): void {
        this.currentThemeIsDark = isDark;
        if (this.container) {
            this.container.dataset.theme = isDark ? 'dark' : 'light';
        }
    }

    /**
     * Create panel with Shadow DOM for style isolation
     */
    private createPanel(markdown: string): void {
        // Pre-process: Fix consecutive inline math formulas
        let processedMarkdown = markdown
            .replace(/\$([^$]+)\$([\u3001\uff0c\u3002\uff1b\uff1a\uff01\uff1f])\$([^$]+)\$/g, '$$$1$$ $2 $$$3$$')
            .replace(/\$([^$]+)\$(\u2014\u2014)\$([^$]+)\$/g, '$$$1$$ $2 $$$3$$');

        // Render Markdown to HTML
        const html = marked.parse(processedMarkdown) as string;

        // Create container
        this.container = document.createElement('div');
        this.container.dataset.theme = this.currentThemeIsDark ? 'dark' : 'light';

        // Attach Shadow DOM for style isolation
        const shadowRoot = this.container.attachShadow({ mode: 'open' });

        // Inject panel styles into Shadow DOM
        const panelStyleEl = document.createElement('style');
        panelStyleEl.textContent = panelStyles;
        shadowRoot.appendChild(panelStyleEl);

        // Inject markdown styles into Shadow DOM using MarkdownRenderer
        const mdStyleEl = document.createElement('style');
        mdStyleEl.textContent = markdownStyles;
        shadowRoot.appendChild(mdStyleEl);

        // Inject KaTeX CSS into Shadow DOM
        const katexLink = document.createElement('link');
        katexLink.rel = 'stylesheet';
        katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        katexLink.crossOrigin = 'anonymous';
        shadowRoot.appendChild(katexLink);

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'aicopy-panel-overlay';
        overlay.addEventListener('click', () => this.hide());

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'aicopy-panel';
        panel.addEventListener('click', (e) => e.stopPropagation());

        // Header
        const header = document.createElement('div');
        header.className = 'aicopy-panel-header';
        header.innerHTML = `
      <div class="aicopy-panel-header-left">
        <h2 class="aicopy-panel-title">Rendered Markdown</h2>
        <button class="aicopy-panel-fullscreen-btn" aria-label="Toggle fullscreen" title="Toggle fullscreen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>
      <button class="aicopy-panel-close" aria-label="Close" title="Close">×</button>
    `;

        // Bind event listeners
        const closeBtn = header.querySelector('.aicopy-panel-close');
        closeBtn?.addEventListener('click', () => this.hide());

        const fullscreenBtn = header.querySelector('.aicopy-panel-fullscreen-btn');
        fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());

        // Body
        const body = document.createElement('div');
        body.className = 'aicopy-panel-body';

        // Create content div
        const content = document.createElement('div');
        content.className = 'markdown-body';
        content.innerHTML = html;

        body.appendChild(content);

        panel.appendChild(header);
        panel.appendChild(body);

        // Assemble in Shadow DOM
        shadowRoot.appendChild(overlay);
        shadowRoot.appendChild(panel);

        // Add container to body
        document.body.appendChild(this.container);

        // ESC key to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Toggle fullscreen mode
     */
    private toggleFullscreen(): void {
        if (!this.container) return;

        const shadowRoot = this.container.shadowRoot;
        if (!shadowRoot) return;

        const panel = shadowRoot.querySelector('.aicopy-panel');
        if (panel) {
            panel.classList.toggle('aicopy-panel-fullscreen');
        }
    }
}
