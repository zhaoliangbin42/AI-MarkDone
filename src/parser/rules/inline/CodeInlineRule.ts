/**
 * Code Inline Rule - Convert <code> (not in <pre>) to `...`
 */

import type { Rule } from '../../core/Rule';

export function createCodeInlineRule(): Rule {
    return {
        name: 'code-inline',

        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const elem = node as Element;

            // Must be <code> but NOT inside <pre>
            if (elem.tagName !== 'CODE') return false;

            // Check if parent is <pre>
            return elem.parentElement?.tagName !== 'PRE';
        },

        priority: 9,

        replacement: (content) => {
            return `\`${content}\``;
        },
    };
}
