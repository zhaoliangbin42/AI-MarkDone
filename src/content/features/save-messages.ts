/**
 * Save Messages Feature
 * 
 * Provides conversation save functionality (Markdown/PDF).
 * Located in src/content/features/ per GEMINI.md architecture.
 */

import { logger } from '../../utils/logger';
import type { SiteAdapter } from '../adapters/base';
import type { MarkdownParser } from '../parsers/markdown-parser';
import { MessageCollector } from '../utils/MessageCollector';
import { StyleManager } from '../../renderer/styles/StyleManager';
import { BUNDLED_KATEX_CSS } from '../../renderer/styles/bundled-katex.css';
import { MarkdownRenderer } from '../../renderer/core/MarkdownRenderer';
import { DesignTokens } from '../../utils/design-tokens';
import { i18n } from '../../utils/i18n';

/**
 * Represents a single chat turn (user prompt + assistant response)
 */
export interface ChatTurn {
    user: string;
    assistant: string;  // Parsed markdown content
    userElement?: HTMLElement;
    assistantElement?: HTMLElement;
    index: number;
}

/**
 * Conversation metadata
 */
export interface ConversationMetadata {
    url: string;
    exportedAt: string;
    title: string;
    count: number;
    platform: string;
}

/**
 * Save format options
 */
export type SaveFormat = 'markdown' | 'pdf';

/**
 * Save messages handler function type
 */
export type SaveMessagesHandler = (
    messages: ChatTurn[],
    selectedIndices: number[],
    format: SaveFormat,
    metadata: ConversationMetadata
) => Promise<void>;

/**
 * Collect all messages from the current page
 * 
 * Reuses MessageCollector for consistency with ReaderPanel.
 * 
 * @param adapter - Platform adapter (for content selector)
 * @param parser - MarkdownParser instance for content extraction
 * @returns Array of chat turns with parsed markdown content
 */
export function collectAllMessages(
    adapter: SiteAdapter,
    parser: MarkdownParser
): ChatTurn[] {
    // Reuse MessageCollector (same as ReaderPanel)
    const messageRefs = MessageCollector.collectMessages();

    logger.debug(`[AI-MarkDone][SaveMessages] MessageCollector returned ${messageRefs.length} messages`);

    if (messageRefs.length === 0) {
        logger.warn('[AI-MarkDone][SaveMessages] No messages found');
        return [];
    }

    // Transform MessageRef[] to ChatTurn[]
    return messageRefs.map((ref) => {
        // Find content element for assistant and parse markdown
        const contentSelector = adapter.getMessageContentSelector();
        const contentEl = contentSelector
            ? ref.element.querySelector(contentSelector) as HTMLElement
            : ref.element;

        const assistantMarkdown = contentEl
            ? parser.parse(contentEl)
            : ref.element.textContent?.trim() || '';

        return {
            user: ref.userPrompt || `Message ${ref.index + 1}`,
            assistant: assistantMarkdown,
            assistantElement: ref.element,
            index: ref.index
        };
    });
}

/**
 * Get conversation metadata
 */
export function getConversationMetadata(adapter: SiteAdapter, count: number): ConversationMetadata {
    let title = 'Conversation';

    // Try adapter-specific title extraction first (e.g., Gemini)
    if (adapter.getConversationTitle) {
        const adapterTitle = adapter.getConversationTitle();
        if (adapterTitle) {
            title = adapterTitle;
        }
    }

    // Fallback to <title> tag
    if (title === 'Conversation') {
        const titleEl = document.querySelector('title');
        title = titleEl?.textContent?.trim() || 'Conversation';

        // Clean up platform-specific suffixes
        title = title
            .replace(' - ChatGPT', '')
            .replace(' - Claude', '')
            .replace(' - Gemini', '')
            .replace(' - DeepSeek', '')
            .trim();
    }

    // Truncate title to 100 characters (Gemini sometimes uses user message as title)
    if (title.length > 100) {
        title = title.substring(0, 100) + '...';
    }

    return {
        url: window.location.href,
        exportedAt: new Date().toISOString(),
        title: title || 'Conversation',
        count,
        platform: adapter.getPlatformName() || 'Unknown'
    };
}

/**
 * Save messages as Markdown
 */
export async function saveMessagesAsMarkdown(
    messages: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata
): Promise<void> {
    const selectedMessages = selectedIndices.map(i => messages[i]).filter(Boolean);

    if (selectedMessages.length === 0) {
        logger.warn('[AI-MarkDone][SaveMessages] No messages selected for Markdown');
        return;
    }

    // Build Markdown content
    let markdown = `# ${metadata.title}\n\n`;
    markdown += `> ${i18n.t('exportMetadata', [metadata.platform, new Date(metadata.exportedAt).toLocaleString()])}\n\n`;

    // Use sequential numbering (1, 2, 3...) regardless of original indices
    selectedMessages.forEach((msg, i) => {
        const messageNum = i + 1;

        // Visual separator between messages (HTML that renders in Markdown)
        if (i > 0) {
            markdown += `\n<div align="center">◆ ◆ ◆</div>\n\n`;
        }

        markdown += `# ${i18n.t('exportMessagePrefix', `${messageNum}`)}\n\n`;
        markdown += `## ${i18n.t('exportUserLabel')}\n\n${msg.user}\n\n`;
        markdown += `## ${i18n.t('exportAssistantLabel')}\n\n${msg.assistant}\n\n`;
    });

    // Trigger download
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = sanitizeFilename(metadata.title) + '.md';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.info(`[AI-MarkDone][SaveMessages] Markdown saved: ${filename}`);
}

/**
 * Save messages as PDF (via print dialog)
 * 
 * Uses MarkdownRenderer to properly render content including formulas.
 * Each message starts on a new page.
 * Uses design tokens for platform-agnostic styling.
 */
export async function saveMessagesAsPdf(
    messages: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata
): Promise<void> {
    const selectedMessages = selectedIndices.map(i => messages[i]).filter(Boolean);

    if (selectedMessages.length === 0) {
        logger.warn('[AI-MarkDone][SaveMessages] No messages selected for PDF');
        return;
    }

    logger.info('[AI-MarkDone][SaveMessages] Creating PDF print container with rendered content');

    // Create print container
    const printContainer = document.createElement('div');
    printContainer.id = 'aimd-pdf-export-container';

    // Use bundled KaTeX CSS (same as reader panel) for reliable formula rendering
    // CDN links may not work during print
    const katexStyles = `<style id="katex-styles-bundled">${BUNDLED_KATEX_CSS}</style>`;

    // Build HTML content with print-optimized CSS
    // Reuse StyleManager's markdown styles for consistency with reader panel
    const baseMarkdownStyles = StyleManager.getMarkdownStyles()
        .replace(/\.markdown-body/g, '#aimd-pdf-export-container');

    // Use DesignTokens for consistent styling (same as reader panel)
    const designTokens = DesignTokens.getCompleteTokens(false); // Light mode for PDF

    let html = `
        ${katexStyles}
        <style>
            /* Design Tokens - Same as reader panel */
            :root {
                ${designTokens}
            }
            
            /* Print-specific rules */
            @media print {
                body > *:not(#aimd-pdf-export-container) {
                    display: none !important;
                }
                #aimd-pdf-export-container {
                    display: block !important;
                    position: static !important;
                    /* Force Chinese fonts for print context where system fallback might fail */
                    font-family: -apple-system, BlinkMacSystemFont, 
                        'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC',
                        'Segoe UI', Roboto, 'Helvetica Neue', Arial,
                        sans-serif !important;
                }
            }
            
            @page {
                margin: 2cm;
            }
            
            /* Base markdown styles from StyleManager (reused for consistency) */
            ${baseMarkdownStyles}
            
            /* PDF-specific layout (no font overrides - use same as reader) */
            #aimd-pdf-export-container {
                display: none;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            
            /* Title page */
            .pdf-title-page {
                text-align: center;
                padding: 100px 20px;
            }
            .pdf-title-page h1 {
                font-size: 28px;
                margin-bottom: 16px;
                color: var(--aimd-text-primary);
            }
            .pdf-title-page .metadata {
                color: var(--aimd-text-secondary);
                font-size: 14px;
            }
            
            /* Message section - each starts on new page */
            .message-section {
                break-before: page;
                page-break-before: always;
            }
            .message-section:first-of-type {
                break-before: auto;
                page-break-before: auto;
            }
            
            /* Message styling */
            .message-header {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 2px solid var(--aimd-border-default);
            }
            .user-prompt {
                background: var(--aimd-bg-secondary);
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 24px;
                border-left: 4px solid var(--color-blue-600);
            }
            .user-prompt-label {
                font-weight: 600;
                color: var(--color-blue-600);
                margin-bottom: 8px;
            }
            .assistant-response {
                padding: 0 16px;
            }
            .assistant-response-label {
                font-weight: 600;
                color: var(--color-green-600);
                margin-bottom: 12px;
            }
            
            /* Typography normalization - cross-platform consistency */
            #aimd-pdf-export-container p {
                margin: 0 0 16px 0;
                line-height: 1.6;
            }
            #aimd-pdf-export-container p:last-child {
                margin-bottom: 0;
            }
            #aimd-pdf-export-container ul,
            #aimd-pdf-export-container ol {
                margin: 0 0 16px 0;
                padding-left: 24px;
            }
            #aimd-pdf-export-container li {
                margin-bottom: 4px;
            }
            #aimd-pdf-export-container h1,
            #aimd-pdf-export-container h2,
            #aimd-pdf-export-container h3,
            #aimd-pdf-export-container h4 {
                margin: 24px 0 12px 0;
                line-height: 1.3;
            }
            #aimd-pdf-export-container h1:first-child,
            #aimd-pdf-export-container h2:first-child,
            #aimd-pdf-export-container h3:first-child {
                margin-top: 0;
            }
            #aimd-pdf-export-container pre {
                margin: 16px 0;
            }
            #aimd-pdf-export-container blockquote {
                margin: 16px 0;
                padding-left: 16px;
            }
            
            /* KaTeX formula styling */
            .katex-display {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        </style>

        <div class="pdf-title-page">
            <h1>${escapeHtml(metadata.title)}</h1>
            <div class="metadata">
                ${i18n.t('pdfExportedFrom', escapeHtml(metadata.platform))}<br>
                ${new Date(metadata.exportedAt).toLocaleString()}<br>
                ${i18n.t('pdfMessagesCount', `${selectedMessages.length}`)}
            </div>
        </div>
    `;

    // Render each message with MarkdownRenderer
    for (let i = 0; i < selectedMessages.length; i++) {
        const msg = selectedMessages[i];
        const messageNum = i + 1;

        // Render assistant content with MarkdownRenderer
        let renderedAssistant = msg.assistant;
        try {
            const result = await MarkdownRenderer.render(msg.assistant, { sanitize: true });
            if (result.success && result.html) {
                renderedAssistant = result.html;
            }
        } catch (e) {
            logger.warn('[AI-MarkDone][SaveMessages] Failed to render markdown, using raw content');
        }

        html += `
            <div class="message-section">
                <div class="message-header">${i18n.t('pdfMessagePrefix', `${messageNum}`)}</div>
                <div class="user-prompt">
                    <div class="user-prompt-label">${i18n.t('pdfUserLabel')}</div>
                    <div>${escapeHtml(msg.user)}</div>
                </div>
                <div class="assistant-response">
                    <div class="assistant-response-label">${i18n.t('pdfAssistantLabel')}</div>
                    <div>${renderedAssistant}</div>
                </div>
            </div>
        `;
    }

    printContainer.innerHTML = html;
    document.body.appendChild(printContainer);

    // Listen for afterprint to cleanup
    const cleanup = () => {
        window.removeEventListener('afterprint', cleanup);
        printContainer.remove();
        logger.debug('[AI-MarkDone][SaveMessages] PDF print container cleaned up');
    };
    window.addEventListener('afterprint', cleanup);

    // Trigger print after next frame (ensures DOM and styles are fully processed)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            logger.info('[AI-MarkDone][SaveMessages] Opening print dialog for PDF');
            window.print();
        });
    });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}
