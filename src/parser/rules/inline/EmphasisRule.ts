/**
 * Emphasis (Italic) Rule - Convert <em> and <i> to *...*
 */

import type { Rule } from '../../core/Rule';

export function createEmphasisRule(): Rule {
    return {
        name: 'emphasis',
        filter: ['em', 'i'],
        priority: 8,

        replacement: (content) => {
            return `*${content}*`;
        },
    };
}
