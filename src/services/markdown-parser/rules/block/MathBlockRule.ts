import type { Rule } from '../../core/Rule';

export function createMathBlockRule(): Rule {
    return {
        name: 'math-block',
        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const elem = node as Element;

            const mathContainer = elem.closest('[data-math]');
            if (mathContainer && mathContainer !== elem) return false;

            const isChatGPTBlock = elem.classList.contains('katex-display');
            const isGeminiBlock = elem.classList.contains('math-block');
            return isChatGPTBlock || isGeminiBlock;
        },
        priority: 1,
        replacement: (content, node, context) => {
            const mathNode = node as HTMLElement;
            const result = context.adapter.extractLatex(mathNode);
            if (!result) return '';
            if (!result.latex) return content;
            return `$$\n${result.latex}\n$$\n\n`;
        },
    };
}

