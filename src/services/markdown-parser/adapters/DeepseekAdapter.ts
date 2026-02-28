import type { IPlatformAdapter, LatexResult } from './IPlatformAdapter';

export class DeepseekAdapter implements IPlatformAdapter {
    readonly name = 'Deepseek';

    selectMathNodes(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('.katex, .katex-display'));
    }

    selectCodeBlocks(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('.md-code-block pre, pre > code'));
    }

    extractLatex(mathNode: HTMLElement): LatexResult | null {
        const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation?.textContent) return { latex: annotation.textContent.trim(), isBlock: this.isBlockMath(mathNode) };

        const dataMath = mathNode.getAttribute('data-math');
        if (dataMath) return { latex: dataMath.trim(), isBlock: this.isBlockMath(mathNode) };

        const text = mathNode.textContent?.trim();
        if (text) return { latex: text, isBlock: this.isBlockMath(mathNode) };

        return null;
    }

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
    }

    isBlockMath(mathNode: HTMLElement): boolean {
        return mathNode.classList.contains('katex-display') || mathNode.closest('.katex-display') !== null;
    }

    cleanText(text: string): string {
        return text;
    }
}

