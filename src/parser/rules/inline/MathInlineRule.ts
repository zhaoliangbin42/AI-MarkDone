/**
 * Math Inline Rule - Convert inline math to $...$
 * 
 * Matches:
 * - ChatGPT: .katex (but not .katex-display)
 * - Gemini: .math-inline[data-math]
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Math Elements (Inline Math)
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for inline math formulas
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

            // ✅ UNIVERSAL FIX: Skip inner rendering nodes wrapped by math container
            // 使用closest()支持多层嵌套,平台无关
            const mathContainer = elem.closest('[data-math]');
            if (mathContainer && mathContainer !== elem) {
                // elem被包裹在有data-math的容器中,跳过
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

            // ✅ Handle null return (e.g., inner .katex nodes filtered by adapter)
            if (!result) {
                // Return empty string to skip this node (already processed by outer container)
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
