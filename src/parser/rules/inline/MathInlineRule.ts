/**
 * Convert inline math to `$...$`.
 * Matches: ChatGPT `.katex` (excluding `.katex-display`), Gemini `.math-inline[data-math]`.
 */

import type { Rule } from '../../core/Rule';

export function createMathInlineRule(): Rule {
    return {
        name: 'math-inline',

        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            const elem = node as Element;

            // Why: only the outer `[data-math]` container should emit markdown; skip inner rendering nodes.
            const mathContainer = elem.closest('[data-math]');
            if (mathContainer && mathContainer !== elem) {
                return false;
            }

            // ChatGPT: .katex (but NOT .katex-display)
            const isChatGPTInline =
                elem.classList.contains('katex') &&
                !elem.classList.contains('katex-display');

            // Gemini: .math-inline (with data-math attribute for rendered math)
            const isGeminiInline = elem.classList.contains('math-inline');

            return isChatGPTInline || isGeminiInline;
        },

        priority: 2, // High priority, just after block math

        replacement: (content, node, context) => {
            const mathNode = node as HTMLElement;

            // Extract LaTeX using adapter
            const result = context.adapter.extractLatex(mathNode);

            if (!result) {
                return '';
            }

            if (!result.latex) {
                // Fallback: return content if LaTeX extraction failed
                console.warn('[MathInlineRule] Failed to extract LaTeX, returning content');
                return content;
            }

            // Format as inline math: $...$
            return `$${result.latex}$`;
        },
    };
}
