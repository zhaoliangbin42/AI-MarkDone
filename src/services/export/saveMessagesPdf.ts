import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import { getTokenCss } from '../../style/tokens';
import { renderMarkdownToSanitizedHtml } from '../renderer/renderMarkdown';

export type PdfPrintPlan = {
    containerId: string;
    html: string;
};

export type BuildPdfPrintPlanOptions = {
    renderMarkdown?: (markdown: string) => string;
};

const CONTAINER_ID = 'aimd-pdf-export-container';

const BUNDLED_KATEX_CSS = `
/* KaTeX v0.16.8 minimal (bundled) */
.katex{font:normal 1.21em KaTeX_Main,Times New Roman,serif;line-height:1.2;text-indent:0;text-rendering:auto}
.katex *{box-sizing:border-box}
.katex .katex-mathml{position:absolute;clip:rect(1px,1px,1px,1px);padding:0;border:0;height:1px;width:1px;overflow:hidden}
.katex .katex-html{display:inline-block}
.katex .base{position:relative;display:inline-block;white-space:nowrap;width:min-content}
.katex .strut{display:inline-block}
.katex-display{display:block;margin:1em 0;text-align:center}
.katex-display>.katex{display:inline-block;text-align:left}
`;

// Ported from the legacy renderer's markdown stylesheet (`StyleManager#getMarkdownStyles`, since removed from `archive/`).
// Why: PDF must be based on extracted markdown, re-rendered with stable line break semantics (`breaks:true`),
// and printed with the same typography normalization the legacy feature relied on.
const LEGACY_MARKDOWN_BODY_CSS = `
      .markdown-body {
        --fgColor-default: var(--aimd-text-primary);
        --fgColor-muted: var(--aimd-text-secondary);
        --fgColor-accent: var(--aimd-text-link, var(--aimd-interactive-primary));
        --bgColor-default: var(--aimd-bg-primary);
        --bgColor-muted: var(--aimd-bg-secondary);
        --borderColor-default: var(--aimd-border-default);
        --codeInline-bg: color-mix(in srgb, var(--bgColor-muted) 84%, var(--fgColor-default) 16%);
        --codeInline-border: color-mix(in srgb, var(--borderColor-default) 70%, transparent);
        --codeBlock-bg: var(--aimd-code-block-bg, var(--aimd-bg-secondary));
        --codeBlock-border: color-mix(in srgb, var(--borderColor-default) 82%, transparent);
        --codeBlock-shadow: inset 0 0 0 1px color-mix(in srgb, var(--borderColor-default) 56%, transparent);
        
        margin: 0;
        padding: 0;
        color: var(--fgColor-default);
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
          'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
        background: var(--codeInline-bg);
        border: 1px solid var(--codeInline-border);
        padding: 0.16em 0.4em;
        border-radius: 3px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
        font-size: 85%;
        color: var(--fgColor-default);
      }

      .markdown-body pre {
        background: var(--codeBlock-bg);
        border: 1px solid var(--codeBlock-border);
        padding: 16px;
        border-radius: 6px;
        overflow: auto;
        margin: 1em 0;
        box-shadow: var(--codeBlock-shadow);
      }

      .markdown-body pre code {
        display: block;
        background: transparent;
        border: none;
        padding: 0;
        white-space: pre;
        font-size: 13px;
        line-height: 1.55;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', monospace;
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

function escapeHtml(text: string): string {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function tokenCssAsRoot(theme: 'light' | 'dark'): string {
    return getTokenCss(theme).replace(':host', ':root');
}

function renderMarkdownForPdf(markdown: string): string {
    // PDF follows the legacy renderer semantics: soft line breaks, math support, and no syntax-highlighting
    // DOM inflation. This keeps the print tree closer to the mature export path without reintroducing old deps.
    return renderMarkdownToSanitizedHtml(markdown, { softBreaks: true, highlightCode: false });
}

export function buildPdfPrintPlan(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    t: TranslateFn,
    options?: BuildPdfPrintPlanOptions
): PdfPrintPlan | null {
    const selected = selectedIndices.map((i) => turns[i]).filter((x): x is ChatTurn => Boolean(x));
    if (selected.length === 0) return null;

    const render = options?.renderMarkdown ?? renderMarkdownForPdf;

    const tokens = tokenCssAsRoot('light');
    const scopedMarkdownCss = LEGACY_MARKDOWN_BODY_CSS
        .replace(/\.markdown-body/g, `#${CONTAINER_ID} .markdown-body`)
        .replace(/\.markdown-fallback/g, `#${CONTAINER_ID} .markdown-fallback`);
    const baseCss = `
${tokens}

@media print {
  :root {
    /* Force high-contrast print colors (legacy expectation: black text on white paper). */
    --aimd-bg-primary: #ffffff;
    --aimd-bg-secondary: #f6f8fa;
    --aimd-text-primary: #000000;
    --aimd-text-secondary: #333333;
    --aimd-border-default: #d0d7de;
  }
  html, body {
    background: var(--aimd-bg-primary) !important;
    color: var(--aimd-text-primary) !important;
  }
  body > *:not(#${CONTAINER_ID}) { display: none !important; }
  #${CONTAINER_ID} {
    display: block !important;
    position: static !important;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  }
  #${CONTAINER_ID}, #${CONTAINER_ID} * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

@page { margin: 2cm; }

#${CONTAINER_ID} {
  display: none;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
}

/* Base markdown styles (legacy parity; scoped to print container) */
${scopedMarkdownCss}

.pdf-title-page { text-align: center; padding: 90px 20px; }
.pdf-title-page h1 { font-size: 28px; margin: 0 0 16px 0; color: var(--aimd-text-primary); }
.pdf-title-page .metadata { color: var(--aimd-text-secondary); font-size: 14px; line-height: 1.6; }

.message-section { break-before: page; page-break-before: always; }
.message-section:first-of-type { break-before: auto; page-break-before: auto; }

.message-header {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--aimd-border-default);
}

.user-prompt {
  background: var(--aimd-bg-secondary);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  border-left: 4px solid var(--aimd-interactive-primary);
}
.user-prompt-label { font-weight: 600; color: var(--aimd-interactive-primary); margin-bottom: 8px; }
.assistant-response { padding: 0 16px; }
.assistant-response-label {
  font-weight: 600;
  margin-bottom: 12px;
  color: color-mix(in srgb, var(--aimd-state-success-border) 88%, var(--aimd-text-primary) 12%);
}

/* Typography normalization (legacy parity) */
#${CONTAINER_ID} p { margin: 0 0 16px 0; line-height: 1.6; }
#${CONTAINER_ID} p:last-child { margin-bottom: 0; }
#${CONTAINER_ID} ul, #${CONTAINER_ID} ol { margin: 0 0 16px 0; padding-left: 24px; }
#${CONTAINER_ID} li { margin-bottom: 4px; }
#${CONTAINER_ID} h1, #${CONTAINER_ID} h2, #${CONTAINER_ID} h3, #${CONTAINER_ID} h4 { margin: 24px 0 12px 0; line-height: 1.3; }
#${CONTAINER_ID} h1:first-child, #${CONTAINER_ID} h2:first-child, #${CONTAINER_ID} h3:first-child { margin-top: 0; }
#${CONTAINER_ID} pre { margin: 16px 0; }
#${CONTAINER_ID} blockquote { margin: 16px 0; padding-left: 16px; }

.katex-display { break-inside: avoid; page-break-inside: avoid; }
`;

    let html = `
<style id="katex-styles-bundled">${BUNDLED_KATEX_CSS}</style>
<style>${baseCss}</style>

<div class="pdf-title-page">
  <h1>${escapeHtml(metadata.title)}</h1>
  <div class="metadata">
    ${t('pdfExportedFrom', escapeHtml(metadata.platform))}<br>
    ${new Date(metadata.exportedAt).toLocaleString()}<br>
    ${t('pdfMessagesCount', `${selected.length}`)}
  </div>
</div>
`;

    selected.forEach((msg, i) => {
        const messageNum = i + 1;
        let renderedAssistant = '';
        try {
            renderedAssistant = render(msg.assistant);
        } catch {
            renderedAssistant = `<pre class="markdown-fallback">${escapeHtml(msg.assistant)}</pre>`;
        }

        html += `
<div class="message-section">
  <div class="message-header">${t('pdfMessagePrefix', `${messageNum}`)}</div>
  <div class="user-prompt">
    <div class="user-prompt-label">${t('pdfUserLabel')}</div>
    <div>${escapeHtml(msg.user)}</div>
  </div>
  <div class="assistant-response">
    <div class="assistant-response-label">${t('pdfAssistantLabel')}</div>
    <div class="markdown-body">${renderedAssistant}</div>
  </div>
</div>
`;
    });

    return { containerId: CONTAINER_ID, html };
}
