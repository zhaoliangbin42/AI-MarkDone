/**
 * Strong (Bold) Rule - Convert <strong> and <b> to **...**
 */

import type { Rule } from '../../core/Rule';

export function createStrongRule(): Rule {
    return {
        name: 'strong',
        filter: ['strong', 'b'],
        priority: 7,

        replacement: (content) => {
            return `**${content}**`;
        },
    };
}
