/**
 * Math Inline Rule - Convert inline math to $...$
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Math Elements (Inline Math)
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for inline math formulas (.katex but not .katex-display)
 * 
 * Priority: 2
 */
export function createMathInlineRule(): Rule {
    return {
        name: 'math-inline',

        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            const elem = node as Element;

            // Must have .katex class but NOT .katex-display
            return (
                elem.classList.contains('katex') &&
                !elem.classList.contains('katex-display')
            );
        },

        priority: 2, // High priority, just after block math

        replacement: (content, node, context) => {
            const mathNode = node as HTMLElement;

            // Extract LaTeX using 5-strategy adapter
            const result = context.adapter.extractLatex(mathNode);

            if (!result || !result.latex) {
                // Fallback: return content
                console.warn('[MathInlineRule] Failed to extract LaTeX, returning content');
                return content;
            }

            // Format as inline math: $...$
            return `$${result.latex}$`;
        },
    };
}
