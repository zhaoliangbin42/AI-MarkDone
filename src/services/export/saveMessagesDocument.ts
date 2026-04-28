import type { ChatTurn, TranslateFn } from './saveMessagesTypes';
import { getTokenCss } from '../../style/tokens';
import { renderMarkdownToSanitizedHtml } from '../renderer/renderMarkdown';
import { getMarkdownThemeCss } from '../renderer/markdownTheme';

export type ExportDocumentTarget = 'pdf' | 'png';

export type ExportMessageDocument = {
    messageNumber: number;
    html: string;
};

export type ExportDocumentBuildOptions = {
    renderMarkdown?: (markdown: string) => string;
};

export function escapeExportHtml(text: string): string {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sanitizeExportFilename(name: string): string {
    const base = (name || 'Conversation')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .trim()
        .substring(0, 100);
    return base || 'Conversation';
}

export function tokenCssAsRoot(theme: 'light' | 'dark'): string {
    return getTokenCss(theme).replace(/:host/g, ':root');
}

export function renderMarkdownForPdfExport(markdown: string): string {
    return renderMarkdownToSanitizedHtml(markdown, { softBreaks: true, highlightCode: false });
}

export function renderMarkdownForPngExport(markdown: string): string {
    return renderMarkdownToSanitizedHtml(markdown, { softBreaks: true, highlightCode: true });
}

export function buildScopedMarkdownCss(containerSelector: string): string {
    const markdownSelector = `${containerSelector} .reader-markdown`;
    return `
${getMarkdownThemeCss(markdownSelector)}

${markdownSelector} {
  font-family: inherit;
}

${markdownSelector} .reader-code-block {
  margin: 0 0 1em;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, var(--aimd-text-primary) 4%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 60%, transparent);
  overflow: hidden;
}
${markdownSelector} .reader-code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 0 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-default) 66%, transparent);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.2;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
${markdownSelector} .reader-code-block__scroll {
  overflow: auto;
}
${markdownSelector} .reader-code-block__scroll :where(pre) {
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
${containerSelector} .markdown-fallback {
  background: var(--aimd-bg-secondary);
  padding: 16px;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  white-space: pre-wrap;
}
`;
}

function decorateCodeBlocksForExport(html: string): string {
    if (!html.trim() || typeof document === 'undefined') return html;

    const template = document.createElement('template');
    template.innerHTML = html;
    const codeBlocks = Array.from(template.content.querySelectorAll<HTMLElement>('pre'));
    for (const pre of codeBlocks) {
        if (pre.parentElement?.classList.contains('reader-code-block__scroll')) continue;
        const code = pre.querySelector<HTMLElement>('code');
        if (!code) continue;

        const wrapper = document.createElement('div');
        wrapper.className = 'reader-code-block';

        const header = document.createElement('div');
        header.className = 'reader-code-block__header';

        const language = pre.dataset.codeLanguage?.trim();
        if (language) {
            const languageEl = document.createElement('span');
            languageEl.className = 'reader-code-block__language';
            languageEl.textContent = language.toUpperCase();
            header.appendChild(languageEl);
        }

        const scroll = document.createElement('div');
        scroll.className = 'reader-code-block__scroll';
        pre.parentNode?.insertBefore(wrapper, pre);
        scroll.appendChild(pre);
        wrapper.append(header, scroll);
    }
    return template.innerHTML;
}

export function buildMessageDocument(
    msg: ChatTurn,
    messageNumber: number,
    t: TranslateFn,
    options?: ExportDocumentBuildOptions,
): ExportMessageDocument {
    const render = options?.renderMarkdown ?? renderMarkdownForPdfExport;
    let renderedAssistant = '';
    try {
        renderedAssistant = decorateCodeBlocksForExport(render(msg.assistant));
    } catch {
        renderedAssistant = `<pre class="markdown-fallback">${escapeExportHtml(msg.assistant)}</pre>`;
    }

    return {
        messageNumber,
        html: `
<div class="message-section">
  <div class="message-header">${t('pdfMessagePrefix', `${messageNumber}`)}</div>
  <div class="user-prompt">
    <div class="user-prompt-label">${t('pdfUserLabel')}</div>
    <div>${escapeExportHtml(msg.user)}</div>
  </div>
  <div class="assistant-response">
    <div class="assistant-response-label">${t('pdfAssistantLabel')}</div>
    <div class="reader-markdown markdown-body">${renderedAssistant}</div>
  </div>
</div>
`,
    };
}

export function selectTurns(turns: ChatTurn[], selectedIndices: number[]): ChatTurn[] {
    return selectedIndices.map((i) => turns[i]).filter((x): x is ChatTurn => Boolean(x));
}
