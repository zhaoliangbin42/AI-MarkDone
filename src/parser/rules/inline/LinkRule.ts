/**
 * Link Rule - Convert <a href="..."> to [text](url)
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Inline Elements
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for hyperlinks
 * 
 * Priority: 10
 */
export function createLinkRule(): Rule {
    return {
        name: 'link',

        filter: ['a'],

        priority: 10,

        replacement: (content, node) => {
            const linkElem = node as HTMLAnchorElement;
            const href = linkElem.getAttribute('href') || '';
            const text = content.trim();

            // If no text, use URL as text
            if (!text) {
                return `[${href}](${href})`;
            }

            // Format: [text](url)
            return `[${text}](${href})`;
        },
    };
}
