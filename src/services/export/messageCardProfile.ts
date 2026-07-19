import type { ExportDocumentV1 } from './imageExportContracts';
import {
    buildMessageDocument,
    buildScopedMarkdownCss,
    renderMarkdownForPngExport,
    tokenCssAsScope,
} from './saveMessagesDocument';

export const MESSAGE_CARD_PROFILE_ROOT_CLASS = 'aimd-png-export-card';

export type MessageCardProfileOptions = {
    widthCssPx: number;
    backgroundColor?: string;
};

export type RenderedMessageCardProfile = {
    rootClass: typeof MESSAGE_CARD_PROFILE_ROOT_CLASS;
    html: string;
};

function buildMessageCardCss(widthCssPx: number, backgroundColor: string): string {
    const containerSelector = `.${MESSAGE_CARD_PROFILE_ROOT_CLASS}`;
    return `
${tokenCssAsScope('light', containerSelector)}

${containerSelector} {
  --aimd-bg-primary: ${backgroundColor};
  --aimd-bg-secondary: #f6f8fa;
  --aimd-text-primary: #000000;
  --aimd-text-secondary: #333333;
  --aimd-border-default: #d0d7de;
}

${containerSelector} {
  box-sizing: border-box;
  width: ${widthCssPx}px;
  padding: 32px;
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow-wrap: anywhere;
}

${containerSelector}, ${containerSelector} * {
  box-sizing: border-box;
}

${buildScopedMarkdownCss(containerSelector)}

${containerSelector} .message-section + .message-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid var(--aimd-border-default);
}

${containerSelector} .message-header {
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--aimd-border-default);
  font-size: 18px;
  font-weight: 600;
}

${containerSelector} .user-prompt {
  margin-bottom: 24px;
  padding: 16px;
  border-left: 4px solid var(--aimd-interactive-primary);
  border-radius: 8px;
  background: var(--aimd-bg-secondary);
  white-space: pre-wrap;
}

${containerSelector} .user-prompt-label {
  margin-bottom: 8px;
  color: var(--aimd-interactive-primary);
  font-weight: 600;
}

${containerSelector} .assistant-response {
  min-width: 0;
  padding: 0 16px;
}

${containerSelector} .assistant-response-label {
  margin-bottom: 12px;
  color: color-mix(in srgb, var(--aimd-state-success-border) 88%, var(--aimd-text-primary) 12%);
  font-weight: 600;
}

${containerSelector} p { margin: 0 0 16px; line-height: 1.6; }
${containerSelector} p:last-child { margin-bottom: 0; }
${containerSelector} ul, ${containerSelector} ol { margin: 0 0 16px; padding-left: 24px; }
${containerSelector} li { margin-bottom: 4px; }
${containerSelector} h1, ${containerSelector} h2, ${containerSelector} h3, ${containerSelector} h4 {
  margin: 24px 0 12px;
  line-height: 1.3;
}
${containerSelector} h1:first-child, ${containerSelector} h2:first-child, ${containerSelector} h3:first-child {
  margin-top: 0;
}
${containerSelector} pre { margin: 16px 0; }
${containerSelector} blockquote { margin: 16px 0; padding-left: 16px; }

${containerSelector} .reader-code-block__scroll,
${containerSelector} .reader-code-block__scroll pre {
  overflow: visible;
  max-height: none;
}
${containerSelector} .reader-markdown pre,
${containerSelector} .reader-markdown pre code {
  max-width: 100%;
  white-space: pre-wrap;
  overflow: visible;
  overflow-wrap: anywhere;
  word-break: break-word;
}
${containerSelector} table {
  display: table;
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  overflow: visible;
}
${containerSelector} th,
${containerSelector} td {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
${containerSelector} img,
${containerSelector} svg,
${containerSelector} canvas {
  max-width: 100%;
  height: auto;
}
${containerSelector} .katex-display {
  max-width: 100%;
  overflow: visible;
  break-inside: avoid;
}

${containerSelector} .aimd-png-image-placeholder {
  margin: 16px 0;
  padding: 18px;
  border: 1px dashed var(--aimd-border-default);
  border-radius: 8px;
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-secondary);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
`;
}

export function renderMessageCardProfile(
    document: ExportDocumentV1,
    options: MessageCardProfileOptions,
): RenderedMessageCardProfile {
    if (document.schemaVersion !== 1 || document.profile !== 'message-card-v1') {
        throw new Error('Unsupported message export document profile.');
    }
    const widthCssPx = Math.max(1, Math.round(options.widthCssPx));
    const sections = document.sections.map((section, index) => buildMessageDocument(
        {
            index: section.sourceIndex,
            user: section.userText,
            assistant: section.assistantMarkdown,
        },
        index + 1,
        (key) => {
            if (key === 'pdfMessagePrefix') return section.heading;
            if (key === 'pdfUserLabel') return document.labels.user;
            if (key === 'pdfAssistantLabel') return document.labels.assistant;
            return key;
        },
        { renderMarkdown: renderMarkdownForPngExport },
    ).html).join('\n');

    return {
        rootClass: MESSAGE_CARD_PROFILE_ROOT_CLASS,
        html: `
<style>${buildMessageCardCss(widthCssPx, options.backgroundColor ?? '#ffffff')}</style>
<div class="${MESSAGE_CARD_PROFILE_ROOT_CLASS}">
${sections}
</div>
`,
    };
}
