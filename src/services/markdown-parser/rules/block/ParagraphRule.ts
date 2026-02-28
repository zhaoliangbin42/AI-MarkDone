import type { Rule } from '../../core/Rule';

export function createParagraphRule(): Rule {
    return {
        name: 'paragraph',
        filter: ['p'],
        priority: 10,
        replacement: (content) => {
            return `${content.trim()}\n\n`;
        },
    };
}

