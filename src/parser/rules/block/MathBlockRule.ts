/**
 * Math Block Rule - Convert display-mode math to $$...$$
 * 
 * Matches:
 * - ChatGPT: .katex-display
 * - Gemini: .math-block[data-math]
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Math Elements (Block Math)
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for block-level math formulas
 * 
 * Priority: 1 (HIGHEST - must process before general katex handling)
 */
export function createMathBlockRule(): Rule {
    return {
        name: 'math-block',

        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            const elem = node as Element;

            // ChatGPT: .katex-display
            const isChatGPTBlock = elem.classList.contains('katex-display');

            // Gemini: .math-block (with data-math attribute for rendered math)
            const isGeminiBlock = elem.classList.contains('math-block');

            return isChatGPTBlock || isGeminiBlock;
        },

        priority: 1, // MANDATORY explicit priority

        replacement: (content, node, context) => {
            const mathNode = node as HTMLElement;

            // Extract LaTeX using 5-strategy adapter
            const result = context.adapter.extractLatex(mathNode);

            if (!result || !result.latex) {
                // Fallback: return content
                console.warn('[MathBlockRule] Failed to extract LaTeX, returning content');
                return content;
            }

            // Format as block math: $$\n...\n$$
            return `$$\n${result.latex}\n$$\n\n`;
        },
    };
}
