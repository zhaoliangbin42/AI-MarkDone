import { omitMarkdownImages } from '../../core/content/chatgptMarkdownCleanup';
import type { RichBlockV1 } from '../../contracts/richContent';
import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';
import { buildMessageExportDocument } from './messageExportDocument';
import { sanitizeExportFilename } from './saveMessagesDocument';
import { projectRichContentMarkdown } from '../content/richContentProjection';
import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    normalizeFormulaSourceFormat,
    rewriteMarkdownFormulaSources,
    type FormulaSourceFormat,
} from '../../core/math/formulaSourceFormat';

export type MarkdownExportResult = {
    filename: string;
    markdown: string;
};

function sanitizeMarkdownHeading(text: string): string {
    const out =
        (text || 'Conversation')
            .replace(/[\r\n]+/g, ' ')
            .replace(/^#+\s*/, '')
            .trim()
            .substring(0, 200) || 'Conversation';
    return out;
}

export function buildMarkdownExport(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    t: TranslateFn,
    options: { formulaFormat?: FormulaSourceFormat; includeImages?: boolean } = {},
): MarkdownExportResult | null {
    const document = buildMessageExportDocument(turns, selectedIndices, {
        title: metadata.title,
        labels: { user: t('exportUserLabel'), assistant: t('exportAssistantLabel') },
        formatHeading: (ordinal) => t('exportMessagePrefix', `${ordinal}`),
    });
    if (!document) return null;

    const markdownTitle = sanitizeMarkdownHeading(metadata.title);
    let markdown = `# ${markdownTitle}\n\n`;
    markdown += `> ${t('exportMetadata', [metadata.platform, new Date(metadata.exportedAt).toLocaleString()])}\n\n`;

    const formulaFormat = normalizeFormulaSourceFormat(options.formulaFormat ?? DEFAULT_FORMULA_SOURCE_FORMAT);
    document.sections.forEach((section, i) => {
        if (i > 0) {
            markdown += `\n---\n\n`;
        }
        markdown += `# ${section.heading}\n\n`;
        markdown += `## ${document.labels.user}\n\n${rewriteMarkdownFormulaSources(options.includeImages === false ? omitMarkdownImages(section.userText) : section.userText, formulaFormat)}\n\n`;
        let body = section.assistantMarkdown;
        if (body.includes('aimd-rich:')) {
            const projection = projectRichContentMarkdown(body, section.richBlocks ?? [], { replacements: options.includeImages ? imageLinkReplacements(section.richBlocks ?? []) : [] });
            if (projection.status !== 'ready' || projection.kind !== 'rich-content') throw new Error('Rich content projection is unavailable.');
            body = projection.markdown;
        }
        if (options.includeImages === false) body = omitMarkdownImages(body);
        markdown += `## ${document.labels.assistant}\n\n${rewriteMarkdownFormulaSources(body, formulaFormat)}\n\n`;
    });

    return {
        filename: `${sanitizeExportFilename(metadata.title)}.md`,
        markdown,
    };
}

function imageLinkReplacements(blocks: readonly RichBlockV1[]): Array<{ id: string; markdown: string }> {
    return blocks.flatMap(block => {
        if (block.source.kind !== 'loaded-image') return [];
        try {
            const url = new URL(block.source.url);
            if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
            const label = block.label.replace(/[\\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
            const href = url.href.replace(/[<>]/g, value => encodeURIComponent(value));
            return [{ id: block.id, markdown: `![${label}](<${href}>)` }];
        } catch { return []; }
    });
}
