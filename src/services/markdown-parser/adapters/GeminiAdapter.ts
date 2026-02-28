import type { IPlatformAdapter, LatexResult } from './IPlatformAdapter';
import { logger } from '../../../core/logger';

export class GeminiAdapter implements IPlatformAdapter {
    readonly name = 'Gemini';

    selectMathNodes(root: HTMLElement): HTMLElement[] {
        const mathInline = Array.from(root.querySelectorAll<HTMLElement>('.math-inline[data-math]'));
        const mathBlock = Array.from(root.querySelectorAll<HTMLElement>('.math-block[data-math]'));
        return [...mathInline, ...mathBlock];
    }

    selectCodeBlocks(root: HTMLElement): HTMLElement[] {
        const geminiCodeBlocks = Array.from(root.querySelectorAll<HTMLElement>('.code-block code, .code-container'));
        const standardCodeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code'));
        const seen = new Set<HTMLElement>();
        const result: HTMLElement[] = [];
        for (const node of [...geminiCodeBlocks, ...standardCodeBlocks]) {
            if (!seen.has(node)) {
                seen.add(node);
                result.push(node);
            }
        }
        return result;
    }

    extractLatex(mathNode: HTMLElement): LatexResult | null {
        try {
            const mathContainer = mathNode.closest('[data-math]');
            if (mathContainer && mathContainer !== mathNode) return null;

            const dataMath = mathNode.getAttribute('data-math');
            if (dataMath && this.validateLatex(dataMath)) {
                return { latex: dataMath, isBlock: this.isBlockMath(mathNode) };
            }

            const katexHtml = mathNode.querySelector('.katex-html');
            const text = katexHtml?.textContent?.trim();
            if (text && this.validateLatex(text)) {
                logger.warn('[AI-MarkDone][GeminiParserAdapter] Fallback triggered: missing data-math');
                return { latex: text, isBlock: this.isBlockMath(mathNode) };
            }

            logger.warn('[AI-MarkDone][GeminiParserAdapter] All strategies failed, preserving HTML');
            return { latex: mathNode.outerHTML, isBlock: this.isBlockMath(mathNode) };
        } catch (error) {
            logger.error('[AI-MarkDone][GeminiParserAdapter] extractLatex failed', error);
            return { latex: mathNode.textContent || mathNode.outerHTML, isBlock: this.isBlockMath(mathNode) };
        }
    }

    private validateLatex(latex: string): boolean {
        if (!latex || latex.trim().length === 0) return false;
        if (latex.length > 50000) return false;
        if (latex.includes('<script>') || latex.includes('javascript:') || latex.includes('onerror=') || latex.includes('onload=')) {
            return false;
        }
        return true;
    }

    getCodeLanguage(codeBlock: HTMLElement): string {
        try {
            const codeBlockWrapper = codeBlock.closest('.code-block');
            if (codeBlockWrapper) {
                const dataLang =
                    codeBlockWrapper.getAttribute('data-lang') ||
                    codeBlockWrapper.getAttribute('data-language') ||
                    codeBlockWrapper.getAttribute('data-code-language');
                if (dataLang) return dataLang.toLowerCase().trim();

                const header = codeBlockWrapper.querySelector('.code-block-decoration');
                const headerText = header?.textContent?.trim().toLowerCase();
                if (headerText && /^[a-z]+$/i.test(headerText) && headerText.length < 20) return headerText;
            }

            const className = codeBlock.getAttribute('class') || '';
            const classMatch = className.match(/language-([a-zA-Z0-9_+-]+)/);
            if (classMatch?.[1]) return classMatch[1].toLowerCase();

            return '';
        } catch {
            return '';
        }
    }

    isBlockMath(mathNode: HTMLElement): boolean {
        return mathNode.classList.contains('math-block') || mathNode.closest('.math-block') !== null;
    }
}

