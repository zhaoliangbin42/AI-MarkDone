import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import {
    BUNDLED_KATEX_CSS,
    buildMessageDocument,
    buildScopedMarkdownCss,
    escapeExportHtml,
    renderMarkdownForPdfExport,
    selectTurns,
    tokenCssAsRoot,
    type ExportDocumentBuildOptions,
} from './saveMessagesDocument';

export type PdfPrintPlan = {
    containerId: string;
    html: string;
};

export type BuildPdfPrintPlanOptions = ExportDocumentBuildOptions;

const CONTAINER_ID = 'aimd-pdf-export-container';

export function buildPdfPrintPlan(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    t: TranslateFn,
    options?: BuildPdfPrintPlanOptions
): PdfPrintPlan | null {
    const selected = selectTurns(turns, selectedIndices);
    if (selected.length === 0) return null;

    const tokens = tokenCssAsRoot('light');
    const scopedMarkdownCss = buildScopedMarkdownCss(`#${CONTAINER_ID}`);
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
  <h1>${escapeExportHtml(metadata.title)}</h1>
  <div class="metadata">
    ${t('pdfExportedFrom', escapeExportHtml(metadata.platform))}<br>
    ${new Date(metadata.exportedAt).toLocaleString()}<br>
    ${t('pdfMessagesCount', `${selected.length}`)}
  </div>
</div>
`;

    selected.forEach((msg, i) => {
        html += buildMessageDocument(msg, i + 1, t, {
            ...options,
            renderMarkdown: options?.renderMarkdown ?? renderMarkdownForPdfExport,
        }).html;
    });

    return { containerId: CONTAINER_ID, html };
}
