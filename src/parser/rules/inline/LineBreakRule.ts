/**
 * Line Break Rule - Convert <br> to double spaces + newline
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Inline Elements
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for line breaks
 * 
 * Priority: 12
 */
export function createLineBreakRule(): Rule {
    return {
        name: 'line-break',

        filter: ['br'],

        priority: 12,

        replacement: () => {
            // Markdown line break: two spaces + newline
            return '  \n';
        },
    };
}
