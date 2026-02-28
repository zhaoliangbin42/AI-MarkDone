import type { IPlatformAdapter, LatexResult } from './IPlatformAdapter';
import { decodeEntities } from '../utils/entities';
import { logger } from '../../../core/logger';

export class ClaudeAdapter implements IPlatformAdapter {
    readonly name = 'Claude';

    selectMathNodes(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('.katex, .katex-display'));
    }

    selectCodeBlocks(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('pre > code'));
    }

    extractLatex(mathNode: HTMLElement): LatexResult | null {
        const strategies = [
            this.extractFromAnnotation.bind(this),
            this.extractFromDataAttribute.bind(this),
            this.extractFromKatexError.bind(this),
            this.extractFromMathML.bind(this),
            this.extractFromTextContent.bind(this),
        ];

        for (const strategy of strategies) {
            try {
                const result = strategy(mathNode);
                if (result && this.validateLatex(result.latex)) return result;
            } catch (error) {
                logger.warn('[AI-MarkDone][ClaudeParserAdapter] LaTeX strategy failed', strategy.name, error);
            }
        }

        logger.error('[AI-MarkDone][ClaudeParserAdapter] All LaTeX strategies failed');
        return { latex: mathNode.outerHTML, isBlock: this.isBlockMath(mathNode) };
    }

    private extractFromAnnotation(mathNode: HTMLElement): LatexResult | null {
        const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
        const latex = annotation?.textContent?.trim();
        if (!latex) return null;
        return { latex, isBlock: this.isBlockMath(mathNode) };
    }

    private extractFromDataAttribute(mathNode: HTMLElement): LatexResult | null {
        const latex = mathNode.getAttribute('data-latex-source') || mathNode.getAttribute('data-math');
        if (!latex) return null;
        return { latex: latex.trim(), isBlock: this.isBlockMath(mathNode) };
    }

    private extractFromKatexError(mathNode: HTMLElement): LatexResult | null {
        const errorElement = mathNode.querySelector('.katex-error');
        if (!errorElement) return null;
        let text = errorElement.textContent?.trim() || '';
        if (!text) return null;
        text = decodeEntities(text);
        text = text.replace(/^ParseError:.*?:\s*/i, '').trim();
        if (!text) return null;
        return { latex: text, isBlock: text.includes('\\begin{') || this.isBlockMath(mathNode) };
    }

    private extractFromMathML(mathNode: HTMLElement): LatexResult | null {
        const math = mathNode.querySelector('math');
        if (!math) return null;
        try {
            const latex = this.mathMLToLatex(math);
            if (!latex) return null;
            return { latex, isBlock: this.isBlockMath(mathNode) };
        } catch (error) {
            logger.warn('[AI-MarkDone][ClaudeParserAdapter] MathML parse failed', error);
            return null;
        }
    }

    private extractFromTextContent(mathNode: HTMLElement): LatexResult | null {
        const text = mathNode.textContent?.trim();
        if (!text) return null;
        return { latex: text, isBlock: this.isBlockMath(mathNode) };
    }

    private mathMLToLatex(element: Element): string {
        const tag = element.tagName.toLowerCase();
        switch (tag) {
            case 'mi':
            case 'mn':
            case 'mo':
                return element.textContent || '';
            case 'mrow':
                return Array.from(element.children)
                    .map((child) => this.mathMLToLatex(child))
                    .join(' ');
            case 'msub': {
                const [base, subscript] = element.children;
                if (!base || !subscript) return '';
                return `{${this.mathMLToLatex(base)}}_{${this.mathMLToLatex(subscript)}}`;
            }
            case 'msup': {
                const [base, superscript] = element.children;
                if (!base || !superscript) return '';
                return `{${this.mathMLToLatex(base)}}^{${this.mathMLToLatex(superscript)}}`;
            }
            case 'mfrac': {
                const [numerator, denominator] = element.children;
                if (!numerator || !denominator) return '';
                return `\\frac{${this.mathMLToLatex(numerator)}}{${this.mathMLToLatex(denominator)}}`;
            }
            case 'msqrt': {
                const content = Array.from(element.children)
                    .map((child) => this.mathMLToLatex(child))
                    .join(' ');
                return `\\sqrt{${content}}`;
            }
            case 'mtext':
                return `\\text{${element.textContent || ''}}`;
            case 'math':
                return Array.from(element.children)
                    .map((child) => this.mathMLToLatex(child))
                    .join(' ');
            default:
                return Array.from(element.children)
                    .map((child) => this.mathMLToLatex(child))
                    .join(' ');
        }
    }

    private validateLatex(latex: string): boolean {
        if (!latex || latex.trim().length === 0) {
            return false;
        }

        if (latex.length > 10000) {
            logger.warn('[AI-MarkDone][ClaudeParserAdapter] LaTeX too long', latex.length);
            return false;
        }

        if (latex.includes('<script>')) {
            logger.error('[AI-MarkDone][ClaudeParserAdapter] XSS attempt detected in LaTeX');
            return false;
        }

        return true;
    }

    getCodeLanguage(codeBlock: HTMLElement): string {
        const classList = Array.from(codeBlock.classList);
        const langClass = classList.find((cls) => cls.startsWith('language-'));
        if (langClass) {
            return langClass.replace('language-', '');
        }

        const parent = codeBlock.parentElement;
        if (parent) {
            const dataLang = parent.getAttribute('data-language');
            if (dataLang) {
                return dataLang;
            }
        }

        return codeBlock.getAttribute('data-language') || '';
    }

    isBlockMath(mathNode: HTMLElement): boolean {
        return mathNode.classList.contains('katex-display') || mathNode.closest('.katex-display') !== null;
    }
}
