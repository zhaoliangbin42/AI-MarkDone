/**
 * Heading Rule - Convert H1-H6 to Markdown headings
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Core Block Elements
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for headings (h1, h2, h3, h4, h5, h6)
 * 
 * Priority: 5
 */
export function createHeadingRule(): Rule {
    return {
        name: 'heading',

        filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], // Tag array

        priority: 5,

        replacement: (content, node) => {
            const level = parseInt((node as Element).tagName.substring(1)); // h1 → 1
            const prefix = '#'.repeat(level); // 1 → '#',  2 → '##', etc.

            // Format: # Content\n\n
            return `${prefix} ${content.trim()}\n\n`;
        },
    };
}
