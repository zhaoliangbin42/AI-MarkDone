import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';

/**
 * Markdown Renderer Utility
 * CRITICAL: Uses exact same logic as re-render panel for consistency
 */
export class MarkdownRenderer {
    private static markedInitialized = false;

    /**
     * Initialize marked with KaTeX support (same as re-render)
     */
    private static initializeMarked(): void {
        if (this.markedInitialized) return;

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

        this.markedInitialized = true;
    }

    /**
     * Render markdown to HTML (same as re-render)
     */
    static render(markdown: string): string {
        this.initializeMarked();

        // Pre-process: Fix consecutive inline math formulas
        // Pattern: $...$、$...$  or  $...$——$...$
        const processedMarkdown = markdown
            .replace(/\$([^$]+)\$([、，。；：！？])\$([^$]+)\$/g, '$$$1$$ $2 $$$3$$')  // Chinese punctuation
            .replace(/\$([^$]+)\$(——)\$([^$]+)\$/g, '$$$1$$ $2 $$$3$$');  // Em dash

        return marked.parse(processedMarkdown) as string;
    }

    /**
     * Inject markdown styles to document head (same as re-render)
     */
    /**
     * Inject styles into Shadow DOM
     * Use this for components that use Shadow DOM (like modals)
     */
    static injectShadowStyles(shadowRoot: ShadowRoot): void {
        // Check if styles already injected
        if (shadowRoot.querySelector('#aicopy-markdown-styles')) {
            return;
        }

        // Inject markdown styles
        const mdStyle = document.createElement('style');
        mdStyle.id = 'aicopy-markdown-styles';
        mdStyle.textContent = this.getMarkdownStyles();
        shadowRoot.appendChild(mdStyle);

        // Inject KaTeX CSS link
        const katexLink = document.createElement('link');
        katexLink.id = 'katex-styles';
        katexLink.rel = 'stylesheet';
        katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        katexLink.crossOrigin = 'anonymous';
        shadowRoot.appendChild(katexLink);
    }

    /**
     * Inject markdown styles to document head (for non-Shadow DOM components)
     */
    static injectStyles(): void {
        // Inject markdown styles (CRITICAL: same as re-render)
        if (!document.querySelector('#aicopy-markdown-styles')) {
            const mdStyle = document.createElement('style');
            mdStyle.id = 'aicopy-markdown-styles';
            mdStyle.textContent = this.getMarkdownStyles();
            document.head.appendChild(mdStyle);
        }

        // Inject KaTeX CSS for math formula rendering
        if (!document.querySelector('#katex-styles')) {
            const link = document.createElement('link');
            link.id = 'katex-styles';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        }
    }

    /**
     * Get markdown styles as string (for Shadow DOM injection)
     * Public method to allow external components to inject styles
     */
    static getMarkdownStyles(): string {
        return `
/* GitHub Markdown Styles - Adapted for Extension */

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

:host-context(html.dark) .markdown-body {
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
    }
}
