import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import type { ExportDocumentV1 } from './imageExportContracts';
import { buildMessageExportDocument } from './messageExportDocument';
import {
    buildMessageDocument,
    buildScopedMarkdownCss,
    escapeExportHtml,
    renderMarkdownForPdfExport,
    tokenCssAsScope,
    type ExportDocumentBuildOptions,
} from './saveMessagesDocument';

export type PdfPrintPlan = {
    containerId: string;
    html: string;
    imageUnavailableLabel: string;
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
    const document = buildMessageExportDocument(turns, selectedIndices, {
        title: metadata.title,
        labels: {
            user: t('pdfUserLabel'),
            assistant: t('pdfAssistantLabel'),
        },
        formatHeading: (ordinal) => t('pdfMessagePrefix', `${ordinal}`),
    });
    if (!document) return null;

    return buildPdfPrintPlanFromDocument(document, metadata, t, options);
}

export function buildPdfPrintPlanFromDocument(
    document: ExportDocumentV1,
    metadata: ConversationMetadata,
    t: TranslateFn,
    options?: BuildPdfPrintPlanOptions,
): PdfPrintPlan {
    const tokens = tokenCssAsScope('light', `#${CONTAINER_ID}`);
    const scopedMarkdownCss = buildScopedMarkdownCss(`#${CONTAINER_ID}`);
    const baseCss = `
${tokens}

@media print {
  html, body {
    background: #ffffff !important;
    color: #000000 !important;
    color-scheme: light !important;
  }
  body > *:not(#${CONTAINER_ID}) { display: none !important; }
  #${CONTAINER_ID} {
    display: block !important;
    position: static !important;
    max-width: none !important;
    padding: 0 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
  }
  #${CONTAINER_ID}, #${CONTAINER_ID} * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

@page { margin: 2cm; background: #ffffff; }

#${CONTAINER_ID} {
  display: block;
  box-sizing: border-box;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  color-scheme: light;
}

/* Base markdown styles (legacy parity; scoped to print container) */
${scopedMarkdownCss}

/* A restrained report layout; physical text sizes stay stable across print hosts. */
#${CONTAINER_ID} {
  --_pdf-space-xs: 0.3em;
  --_pdf-space-sm: 0.65em;
  --_pdf-space-md: 1em;
  --_pdf-space-lg: 1.5em;
  --_pdf-space-xl: 2em;
  font-family: var(--aimd-font-family-sans);
  font-size: 10.5pt;
  line-height: 1.65;
}
#${CONTAINER_ID} .pdf-title-page {
  padding: 0 0 var(--_pdf-space-xl);
  margin: 0 0 var(--_pdf-space-xl);
  border-bottom: 2px solid var(--aimd-text-primary);
  break-inside: avoid;
}
#${CONTAINER_ID} .pdf-document-label {
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--aimd-text-secondary);
  margin-bottom: var(--_pdf-space-md);
}
#${CONTAINER_ID} .pdf-title-page h1 {
  font-family: var(--aimd-font-family-serif);
  font-size: 26pt;
  font-weight: 500;
  line-height: 1.22;
  letter-spacing: -0.02em;
  margin: 0 0 var(--_pdf-space-sm);
  overflow-wrap: anywhere;
}
#${CONTAINER_ID} .metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--_pdf-space-sm) var(--_pdf-space-lg);
  font-size: 8pt;
  color: var(--aimd-text-secondary);
  font-variant-numeric: tabular-nums;
}
.message-section { break-before: auto; page-break-before: auto; margin-top: var(--_pdf-space-xl); }
.message-section:first-of-type { margin-top: 0; }
#${CONTAINER_ID} .message-header {
  font-size: 9pt;
  font-weight: 600;
  margin: 0 0 var(--_pdf-space-lg);
  padding-bottom: var(--_pdf-space-sm);
  border-bottom: 1px solid var(--aimd-border-default);
  color: var(--aimd-text-secondary);
}
#${CONTAINER_ID} .user-prompt {
  background: transparent;
  border-left: 2px solid var(--aimd-border-default);
  padding: 0 0 0 var(--_pdf-space-md);
  margin-bottom: var(--_pdf-space-xl);
  font-size: 9.5pt;
  color: var(--aimd-text-secondary);
}
#${CONTAINER_ID} .user-prompt > div:last-child { white-space: pre-wrap; }
#${CONTAINER_ID} .user-prompt-label,
#${CONTAINER_ID} .assistant-response-label {
  font-family: var(--aimd-font-family-sans);
  font-size: 8pt;
  font-weight: 600;
  color: var(--aimd-text-secondary);
  margin-bottom: var(--_pdf-space-sm);
}
#${CONTAINER_ID} .assistant-response { padding: 0; }
#${CONTAINER_ID} .reader-markdown { font-size: inherit; line-height: 1.7; }
#${CONTAINER_ID} p { margin: 0 0 var(--_pdf-space-md); line-height: 1.7; }
#${CONTAINER_ID} p:last-child { margin-bottom: 0; }
#${CONTAINER_ID} ul, #${CONTAINER_ID} ol { margin: 0 0 var(--_pdf-space-md); padding-left: var(--_pdf-space-lg); }
#${CONTAINER_ID} li { margin-bottom: var(--_pdf-space-xs); }
#${CONTAINER_ID} .reader-markdown :where(h1, h2, h3, h4) { margin: var(--_pdf-space-lg) 0 var(--_pdf-space-sm); line-height: 1.3; letter-spacing: 0; }
#${CONTAINER_ID} .reader-markdown :where(h1) { font-size: 19pt; border: 0; padding: 0; }
#${CONTAINER_ID} .reader-markdown :where(h2) { font-size: 14pt; padding-bottom: var(--_pdf-space-xs); border-bottom: 1px solid var(--aimd-border-subtle); }
#${CONTAINER_ID} .reader-markdown :where(h3) { font-size: 11.5pt; }
#${CONTAINER_ID} .reader-markdown > :first-child { margin-top: 0; }
#${CONTAINER_ID} pre { margin: var(--_pdf-space-md) 0; }
#${CONTAINER_ID} .reader-markdown .reader-code-block { border-radius: var(--aimd-radius-sm); box-shadow: none; background: var(--aimd-bg-secondary); }
#${CONTAINER_ID} .reader-markdown .reader-code-block__header { min-height: 0; padding: var(--_pdf-space-sm) var(--_pdf-space-md); font-size: 7.5pt; }
#${CONTAINER_ID} .reader-markdown .reader-code-block__header:empty { display: none; }
#${CONTAINER_ID} .reader-markdown :where(pre code) { font-size: 8.5pt; line-height: 1.55; }
#${CONTAINER_ID} .reader-markdown :where(th, td) { padding: var(--_pdf-space-sm) var(--_pdf-space-sm); border-inline: 0; font-size: 9pt; }
#${CONTAINER_ID} .reader-markdown :where(blockquote) { margin: var(--_pdf-space-md) 0; padding: var(--_pdf-space-xs) 0 var(--_pdf-space-xs) var(--_pdf-space-md); border-left: 2px solid var(--aimd-border-default); border-radius: 0; background: transparent; }
#${CONTAINER_ID} .reader-markdown :where(img) { max-height: 210mm; object-fit: contain; border-radius: var(--aimd-radius-sm); }

#${CONTAINER_ID} .reader-markdown :where(pre),
#${CONTAINER_ID} .reader-markdown .reader-code-block,
#${CONTAINER_ID} .reader-markdown .reader-code-block__scroll {
  overflow: visible;
  break-inside: auto;
}
#${CONTAINER_ID} .reader-markdown :where(pre code) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
#${CONTAINER_ID} .reader-markdown :where(table) {
  display: table;
  table-layout: fixed;
  overflow: visible;
}
#${CONTAINER_ID} .user-prompt,
#${CONTAINER_ID} .reader-markdown :where(th, td, a) {
  overflow-wrap: anywhere;
}
#${CONTAINER_ID} .reader-markdown :where(thead) { display: table-header-group; }
#${CONTAINER_ID} :where(tr, .reader-code-block__header, img) { break-inside: avoid; }
#${CONTAINER_ID} :where(h1, h2, h3, h4, h5, h6, .message-header, .reader-code-block__header) { break-after: avoid; }
#${CONTAINER_ID} :where(p, li) { orphans: 3; widows: 3; }
#${CONTAINER_ID} .reader-markdown .katex-display {
  overflow: visible;
  break-inside: avoid;
  page-break-inside: avoid;
}
`;

    let html = `
<style>${baseCss}</style>

<header class="pdf-title-page">
  <div class="pdf-document-label">AI-MarkDone / ${escapeExportHtml(t('pdfDocumentLabel'))}</div>
  <h1>${escapeExportHtml(document.title)}</h1>
  <div class="metadata">
    <span>${t('pdfExportedFrom', escapeExportHtml(metadata.platform))}</span>
    <span>${new Date(metadata.exportedAt).toLocaleString()}</span>
    <span>${t('pdfMessagesCount', `${document.sections.length}`)}</span>
  </div>
</header>
`;

    document.sections.forEach((section, index) => {
        html += buildMessageDocument({
            index: section.sourceIndex,
            user: section.userText,
            assistant: section.assistantMarkdown,
            richBlocks: section.richBlocks,
            richImages: section.richImages,
        }, index + 1, (key, args) => {
            if (key === 'pdfMessagePrefix') return section.heading;
            if (key === 'pdfUserLabel') return document.labels.user;
            if (key === 'pdfAssistantLabel') return document.labels.assistant;
            return t(key, args);
        }, {
            ...options,
            renderMarkdown: options?.renderMarkdown ?? renderMarkdownForPdfExport,
        }).html;
    });

    return { containerId: CONTAINER_ID, html, imageUnavailableLabel: t('pdfImageUnavailable') };
}
