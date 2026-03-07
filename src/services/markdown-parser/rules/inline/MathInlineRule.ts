import type { Rule } from '../../core/Rule';

export function createMathInlineRule(): Rule {
    return {
        name: 'math-inline',
        filter: (node, adapter) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const mathNode = node as HTMLElement;
            return adapter.isMathNode(mathNode) && !adapter.isBlockMath(mathNode);
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
