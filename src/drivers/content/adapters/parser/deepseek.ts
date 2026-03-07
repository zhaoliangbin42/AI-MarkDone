import type { LatexResult, MarkdownParserAdapter } from './MarkdownParserAdapter';

function isDeepseekBlockMath(mathNode: HTMLElement): boolean {
    return mathNode.classList.contains('katex-display') || mathNode.closest('.katex-display') !== null;
}

export const deepseekMarkdownParserAdapter: MarkdownParserAdapter = {
    name: 'Deepseek',
    isMathNode(node: Element): boolean {
        const element = node as HTMLElement;
        const mathContainer = element.closest?.('[data-math]');
        if (mathContainer && mathContainer !== element) return false;
        return element.classList.contains('katex') || element.classList.contains('katex-display');
    },
    isCodeBlockNode(node: Element): boolean {
        return node.tagName === 'PRE' && (node.closest('.md-code-block') !== null || node.querySelector('code') !== null);
    },
    extractLatex(mathNode: HTMLElement): LatexResult | null {
        const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation?.textContent) return { latex: annotation.textContent.trim(), isBlock: isDeepseekBlockMath(mathNode) };

        const dataMath = mathNode.getAttribute('data-math');
        if (dataMath) return { latex: dataMath.trim(), isBlock: isDeepseekBlockMath(mathNode) };

        const text = mathNode.textContent?.trim();
        if (text) return { latex: text, isBlock: isDeepseekBlockMath(mathNode) };

        return null;
    },
    getCodeLanguage(codeBlock: HTMLElement): string {
        const mdCodeBlock = codeBlock.closest('.md-code-block');
        if (mdCodeBlock) {
            const langSpan = mdCodeBlock.querySelector('.d813de27');
            if (langSpan?.textContent) return langSpan.textContent.trim();
        }

        const classList = Array.from(codeBlock.classList);
        const langClass = classList.find((cls) => cls.startsWith('language-'));
        if (langClass) return langClass.replace('language-', '');

        return '';
    },
    isBlockMath: isDeepseekBlockMath,
    cleanText(text: string): string {
        return text;
    },
};
