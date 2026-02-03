/**
 * Convert display-mode math to `$$...$$`.
 * Matches: ChatGPT `.katex-display`, Gemini `.math-block[data-math]`.
 */

import type { Rule } from '../../core/Rule';

export function createMathBlockRule(): Rule {
    return {
        name: 'math-block',

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

            // ChatGPT: .katex-display
            const isChatGPTBlock = elem.classList.contains('katex-display');

            // Gemini: .math-block (with data-math attribute for rendered math)
            const isGeminiBlock = elem.classList.contains('math-block');

            return isChatGPTBlock || isGeminiBlock;
        },

        priority: 1, // MANDATORY explicit priority

        replacement: (content, node, context) => {
            const mathNode = node as HTMLElement;

            // Extract LaTeX using adapter
            const result = context.adapter.extractLatex(mathNode);

            if (!result) {
                return '';
            }

            if (!result.latex) {
                // Fallback: return content if LaTeX extraction failed
                console.warn('[MathBlockRule] Failed to extract LaTeX, returning content');
                return content;
            }

            // Format as block math: $$\n...\n$$
            return `$$\n${result.latex}\n$$\n\n`;
        },
    };
}
