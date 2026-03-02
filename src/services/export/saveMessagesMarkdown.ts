import type { ChatTurn, ConversationMetadata, TranslateFn } from './saveMessagesTypes';

export type MarkdownExportResult = {
    filename: string;
    markdown: string;
};

function sanitizeFilename(name: string): string {
    const base = (name || 'Conversation')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .trim()
        .substring(0, 100);
    return base || 'Conversation';
}

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
    t: TranslateFn
): MarkdownExportResult | null {
    const selected = selectedIndices.map((i) => turns[i]).filter((x): x is ChatTurn => Boolean(x));
    if (selected.length === 0) return null;

    const markdownTitle = sanitizeMarkdownHeading(metadata.title);
    let markdown = `# ${markdownTitle}\n\n`;
    markdown += `> ${t('exportMetadata', [metadata.platform, new Date(metadata.exportedAt).toLocaleString()])}\n\n`;

    selected.forEach((msg, i) => {
        const messageNum = i + 1;
        if (i > 0) {
            markdown += `\n<div align="center">◆ ◆ ◆</div>\n\n`;
        }
        markdown += `# ${t('exportMessagePrefix', `${messageNum}`)}\n\n`;
        markdown += `## ${t('exportUserLabel')}\n\n${msg.user}\n\n`;
        markdown += `## ${t('exportAssistantLabel')}\n\n${msg.assistant}\n\n`;
    });

    return {
        filename: `${sanitizeFilename(metadata.title)}.md`,
        markdown,
    };
}

