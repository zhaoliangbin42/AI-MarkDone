import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import { renderMarkdownToSanitizedHtml } from '../renderer/renderMarkdown';
import { getTokenCss } from '../../style/tokens';

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

export function buildPdfPrintPlan(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    t: TranslateFn,
    options?: BuildPdfPrintPlanOptions
): PdfPrintPlan | null {
    const selected = selectedIndices.map((i) => turns[i]).filter((x): x is ChatTurn => Boolean(x));
    if (selected.length === 0) return null;

    const render = options?.renderMarkdown ?? renderMarkdownToSanitizedHtml;

    const tokens = tokenCssAsRoot('light');
    const baseCss = `
${tokens}

@media print {
  body > *:not(#${CONTAINER_ID}) { display: none !important; }
  #${CONTAINER_ID} {
    display: block !important;
    position: static !important;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  }
}

@page { margin: 2cm; }

#${CONTAINER_ID} {
  display: none;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  color: var(--aimd-text-primary);
}

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
.assistant-response-label { font-weight: 600; margin-bottom: 12px; color: #16a34a; }

/* Minimal markdown-ish typography */
.assistant-response p { margin: 0 0 16px 0; line-height: 1.6; }
.assistant-response p:last-child { margin-bottom: 0; }
.assistant-response pre {
  margin: 16px 0;
  padding: 16px;
  border-radius: 8px;
  overflow: auto;
  background: var(--aimd-bg-secondary);
  border: 1px solid var(--aimd-border-default);
}
.assistant-response code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9em;
}
.assistant-response table { border-collapse: collapse; width: 100%; }
.assistant-response th, .assistant-response td { border: 1px solid var(--aimd-border-default); padding: 6px 10px; }
.assistant-response blockquote {
  margin: 16px 0;
  padding-left: 16px;
  border-left: 4px solid var(--aimd-border-default);
  color: var(--aimd-text-secondary);
}

.markdown-fallback {
  background: var(--aimd-bg-secondary);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--aimd-border-default);
  font-family: ui-monospace, monospace;
  font-size: 13px;
  white-space: pre-wrap;
}

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
    <div>${renderedAssistant}</div>
  </div>
</div>
`;
    });

    return { containerId: CONTAINER_ID, html };
}

