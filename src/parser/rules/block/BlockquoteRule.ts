/**
 * Blockquote Rule - Convert <blockquote> to Markdown quotes
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Block Elements
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for blockquote elements
 * 
 * Priority: 6 (same as lists)
 */
export function createBlockquoteRule(): Rule {
    return {
        name: 'blockquote',

        filter: ['blockquote'],

        priority: 6,

        replacement: (content, _node, _context) => {
            // Split content into lines and prefix each with '> '
            const lines = content.trim().split('\n');
            const quotedLines = lines.map(line => {
                // Handle nested blockquotes (already have '>')
                if (line.trim().startsWith('>')) {
                    return `> ${line}`;
                }
                return `> ${line}`;
            });

            return quotedLines.join('\n') + '\n\n';
        },
    };
}
