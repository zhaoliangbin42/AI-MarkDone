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

            // ✅ UNIVERSAL FIX: Skip inner rendering nodes wrapped by math container
            // 使用closest()支持多层嵌套,平台无关
            const mathContainer = elem.closest('[data-math]');
            if (mathContainer && mathContainer !== elem) {
                // elem被包裹在有data-math的容器中,跳过
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

            // ✅ Handle null return (e.g., inner .katex nodes filtered by adapter)
            if (!result) {
                // Return empty string to skip this node (already processed by outer container)
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
