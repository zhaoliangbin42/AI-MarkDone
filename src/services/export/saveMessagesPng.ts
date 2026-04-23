import { DEFAULT_PNG_EXPORT_WIDTH } from '../../core/settings/export';
import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import {
    BUNDLED_KATEX_CSS,
    buildMessageDocument,
    buildScopedMarkdownCss,
    renderMarkdownForPngExport,
    sanitizeExportFilename,
    selectTurns,
    tokenCssAsRoot,
    type ExportDocumentBuildOptions,
} from './saveMessagesDocument';

export type PngExportOptions = {
    width: number;
    pixelRatio: number;
    backgroundColor: string;
};

export type PngCardPlan = {
    filename: string;
    html: string;
    width: number;
    pixelRatio: number;
    backgroundColor: string;
};

export type PngExportPlanResult = {
    plans: PngCardPlan[];
    zipFilename: string;
    options: PngExportOptions;
};

export type BuildPngExportPlanOptions = Partial<PngExportOptions> & ExportDocumentBuildOptions;

const DEFAULT_OPTIONS: PngExportOptions = {
    width: DEFAULT_PNG_EXPORT_WIDTH,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
};

const PNG_CONTAINER_CLASS = 'aimd-png-export-card';

function resolveOptions(options?: BuildPngExportPlanOptions): PngExportOptions {
    return {
        width: options?.width ?? DEFAULT_OPTIONS.width,
        pixelRatio: options?.pixelRatio ?? DEFAULT_OPTIONS.pixelRatio,
        backgroundColor: options?.backgroundColor ?? DEFAULT_OPTIONS.backgroundColor,
    };
}

function buildPngCss(options: PngExportOptions): string {
    const containerSelector = `.${PNG_CONTAINER_CLASS}`;
    const scopedMarkdownCss = buildScopedMarkdownCss(containerSelector);
    return `
${tokenCssAsRoot('light')}

:root {
  --aimd-bg-primary: ${options.backgroundColor};
  --aimd-bg-secondary: #f6f8fa;
  --aimd-text-primary: #000000;
  --aimd-text-secondary: #333333;
  --aimd-border-default: #d0d7de;
}

${containerSelector} {
  box-sizing: border-box;
  width: ${options.width}px;
  padding: 32px;
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

${containerSelector}, ${containerSelector} * {
  box-sizing: border-box;
}

${scopedMarkdownCss}

${containerSelector} .message-section {
  break-before: auto;
  page-break-before: auto;
}

${containerSelector} .message-header {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--aimd-border-default);
}

${containerSelector} .user-prompt {
  background: var(--aimd-bg-secondary);
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  border-left: 4px solid var(--aimd-interactive-primary);
}

${containerSelector} .user-prompt-label {
  font-weight: 600;
  color: var(--aimd-interactive-primary);
  margin-bottom: 8px;
}

${containerSelector} .assistant-response {
  padding: 0 16px;
}

${containerSelector} .assistant-response-label {
  font-weight: 600;
  margin-bottom: 12px;
  color: color-mix(in srgb, var(--aimd-state-success-border) 88%, var(--aimd-text-primary) 12%);
}

${containerSelector} p { margin: 0 0 16px 0; line-height: 1.6; }
${containerSelector} p:last-child { margin-bottom: 0; }
${containerSelector} ul, ${containerSelector} ol { margin: 0 0 16px 0; padding-left: 24px; }
${containerSelector} li { margin-bottom: 4px; }
${containerSelector} h1, ${containerSelector} h2, ${containerSelector} h3, ${containerSelector} h4 { margin: 24px 0 12px 0; line-height: 1.3; }
${containerSelector} h1:first-child, ${containerSelector} h2:first-child, ${containerSelector} h3:first-child { margin-top: 0; }
${containerSelector} pre { margin: 16px 0; }
${containerSelector} blockquote { margin: 16px 0; padding-left: 16px; }
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
.katex-display { break-inside: avoid; page-break-inside: avoid; }
`;
}

export function buildPngExportPlans(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    t: TranslateFn,
    options?: BuildPngExportPlanOptions,
): PngExportPlanResult | null {
    const selected = selectTurns(turns, selectedIndices);
    if (selected.length === 0) return null;

    const resolved = resolveOptions(options);
    const baseName = sanitizeExportFilename(metadata.title);
    const css = buildPngCss(resolved);
    const plans = selected.map((turn, index) => {
        const messageNumber = index + 1;
        const message = buildMessageDocument(turn, messageNumber, t, {
            ...options,
            renderMarkdown: options?.renderMarkdown ?? renderMarkdownForPngExport,
        });
        return {
            filename: `${baseName}-message-${String(messageNumber).padStart(3, '0')}.png`,
            html: `
<style id="katex-styles-bundled">${BUNDLED_KATEX_CSS}</style>
<style>${css}</style>
<div class="${PNG_CONTAINER_CLASS}">
${message.html}
</div>
`,
            width: resolved.width,
            pixelRatio: resolved.pixelRatio,
            backgroundColor: resolved.backgroundColor,
        };
    });

    return {
        plans,
        zipFilename: `${baseName}-png.zip`,
        options: resolved,
    };
}
