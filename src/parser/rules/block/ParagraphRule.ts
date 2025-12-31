/**
 * Paragraph Rule - Convert <p> to Markdown paragraphs
 */

import type { Rule } from '../../core/Rule';

export function createParagraphRule(): Rule {
    return {
        name: 'paragraph',
        filter: ['p'],
        priority: 10, // Lower priority (processed later)

        replacement: (content) => {
            // Paragraphs: content + double newline
            return `${content.trim()}\n\n`;
        },
    };
}
