/**
 * Horizontal Rule - Convert <hr> to Markdown horizontal line
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Block Elements
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for horizontal rule (separator line)
 * 
 * Priority: 11
 */
export function createHorizontalRuleRule(): Rule {
    return {
        name: 'horizontal-rule',

        filter: ['hr'],

        priority: 11,

        replacement: () => {
            // Markdown horizontal rule: ---
            return '\n---\n\n';
        },
    };
}
