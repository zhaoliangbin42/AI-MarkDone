import type { Rule } from '../../core/Rule';

export function createStrongRule(): Rule {
    return {
        name: 'strong',
        filter: ['strong', 'b'],
        priority: 11,
        replacement: (content) => {
            return `**${content}**`;
        },
    };
}

