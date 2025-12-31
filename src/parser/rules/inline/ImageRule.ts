/**
 * Image Rule - Convert <img> to ![alt](url)
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Inline Elements
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for images
 * 
 * Priority: 11
 */
export function createImageRule(): Rule {
    return {
        name: 'image',

        filter: ['img'],

        priority: 11,

        replacement: (_content, node) => {
            const imgElem = node as HTMLImageElement;
            const src = imgElem.getAttribute('src') || '';
            const alt = imgElem.getAttribute('alt') || '';

            // Format: ![alt](url)
            return `![${alt}](${src})`;
        },
    };
}
