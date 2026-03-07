import type { Rule } from '../../core/Rule';

export function createMathBlockRule(): Rule {
    return {
        name: 'math-block',
        filter: (node, adapter) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const mathNode = node as HTMLElement;
            return adapter.isMathNode(mathNode) && adapter.isBlockMath(mathNode);
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
