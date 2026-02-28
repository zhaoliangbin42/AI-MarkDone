import type { Rule } from '../../core/Rule';

export function createEmphasisRule(): Rule {
    return {
        name: 'emphasis',
        filter: ['em', 'i'],
        priority: 11,
        replacement: (content) => {
            return `*${content}*`;
        },
    };
}

