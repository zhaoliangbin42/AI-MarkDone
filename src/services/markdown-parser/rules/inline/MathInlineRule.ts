import type { Rule } from '../../core/Rule';

export function createMathInlineRule(): Rule {
    return {
        name: 'math-inline',
        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const elem = node as Element;

            const mathContainer = elem.closest('[data-math]');
            if (mathContainer && mathContainer !== elem) return false;

            const isChatGPTInline = elem.classList.contains('katex') && !elem.closest('.katex-display');
            const isGeminiInline = elem.classList.contains('math-inline');

            return isChatGPTInline || isGeminiInline;
        },
        priority: 2,
        replacement: (content, node, context) => {
            const mathNode = node as HTMLElement;
            const result = context.adapter.extractLatex(mathNode);
            if (!result) return '';
            if (!result.latex) return content;
            return `$${result.latex}$`;
        },
    };
}

