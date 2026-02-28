import type { Rule } from '../../core/Rule';

export function createBlockquoteRule(): Rule {
    return {
        name: 'blockquote',
        filter: ['blockquote'],
        priority: 6,
        replacement: (content) => {
            const lines = content.trim().split('\n');
            const quotedLines = lines.map((line) => {
                if (line.trim().startsWith('>')) return `> ${line}`;
                return `> ${line}`;
            });
            return quotedLines.join('\n') + '\n\n';
        },
    };
}

