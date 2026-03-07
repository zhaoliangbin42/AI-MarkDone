import { logger } from '../../../../core/logger';
import type { LatexResult, MarkdownParserAdapter } from './MarkdownParserAdapter';
import { decodeEntities } from './decodeEntities';

function extractFromAnnotation(mathNode: HTMLElement): LatexResult | null {
    const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation?.textContent?.trim();
    if (!latex) return null;
    return { latex, isBlock: isBlockMath(mathNode) };
}

function extractFromDataAttribute(mathNode: HTMLElement): LatexResult | null {
    const latex = mathNode.getAttribute('data-latex-source') || mathNode.getAttribute('data-math');
    if (!latex) return null;
    return { latex: latex.trim(), isBlock: isBlockMath(mathNode) };
}

function extractFromKatexError(mathNode: HTMLElement): LatexResult | null {
    const errorElement = mathNode.querySelector('.katex-error');
    if (!errorElement) return null;
    let text = errorElement.textContent?.trim() || '';
    if (!text) return null;
    text = decodeEntities(text);
    text = text.replace(/^ParseError:.*?:\s*/i, '').trim();
    if (!text) return null;
    return { latex: text, isBlock: text.includes('\\begin{') || isBlockMath(mathNode) };
}

function mathMLToLatex(element: Element): string {
    const tag = element.tagName.toLowerCase();
    switch (tag) {
        case 'mi':
        case 'mn':
        case 'mo':
            return element.textContent || '';
        case 'mrow':
            return Array.from(element.children)
                .map((child) => mathMLToLatex(child))
                .join(' ');
        case 'msub': {
            const [base, subscript] = element.children;
            if (!base || !subscript) return '';
            return `{${mathMLToLatex(base)}}_{${mathMLToLatex(subscript)}}`;
        }
        case 'msup': {
            const [base, superscript] = element.children;
            if (!base || !superscript) return '';
            return `{${mathMLToLatex(base)}}^{${mathMLToLatex(superscript)}}`;
        }
        case 'mfrac': {
            const [numerator, denominator] = element.children;
            if (!numerator || !denominator) return '';
            return `\\frac{${mathMLToLatex(numerator)}}{${mathMLToLatex(denominator)}}`;
        }
        case 'msqrt': {
            const content = Array.from(element.children)
                .map((child) => mathMLToLatex(child))
                .join(' ');
            return `\\sqrt{${content}}`;
        }
        case 'mtext':
            return `\\text{${element.textContent || ''}}`;
        case 'math':
            return Array.from(element.children)
                .map((child) => mathMLToLatex(child))
                .join(' ');
        default:
            return Array.from(element.children)
                .map((child) => mathMLToLatex(child))
                .join(' ');
    }
}

function extractFromMathML(mathNode: HTMLElement, logLabel: string): LatexResult | null {
    const math = mathNode.querySelector('math');
    if (!math) return null;
    try {
        const latex = mathMLToLatex(math);
        if (!latex) return null;
        return { latex, isBlock: isBlockMath(mathNode) };
    } catch (error) {
        logger.warn(`[AI-MarkDone][${logLabel}] MathML parse failed`, error);
        return null;
    }
}

function extractFromTextContent(mathNode: HTMLElement): LatexResult | null {
    const text = mathNode.textContent?.trim();
    if (!text) return null;
    return { latex: text, isBlock: isBlockMath(mathNode) };
}

function isBlockMath(mathNode: HTMLElement): boolean {
    return mathNode.classList.contains('katex-display') || mathNode.closest('.katex-display') !== null;
}

function validateLatex(latex: string, logLabel: string): boolean {
    if (!latex || latex.trim().length === 0) {
        return false;
    }

    if (latex.length > 10000) {
        logger.warn(`[AI-MarkDone][${logLabel}] LaTeX too long`, latex.length);
        return false;
    }

    if (latex.includes('<script>')) {
        logger.error(`[AI-MarkDone][${logLabel}] XSS attempt detected in LaTeX`);
        return false;
    }

    return true;
}

export function createKatexMarkdownParserAdapter(name: string, logLabel: string): MarkdownParserAdapter {
    return {
        name,
        isMathNode(node: Element): boolean {
            const element = node as HTMLElement;
            const mathContainer = element.closest?.('[data-math]');
            if (mathContainer && mathContainer !== element) return false;
            return element.classList.contains('katex') || element.classList.contains('katex-display');
        },
        isCodeBlockNode(node: Element): boolean {
            return node.tagName === 'PRE' && node.querySelector('code') !== null;
        },
        extractLatex(mathNode: HTMLElement): LatexResult | null {
            const strategies = [
                () => extractFromAnnotation(mathNode),
                () => extractFromDataAttribute(mathNode),
                () => extractFromKatexError(mathNode),
                () => extractFromMathML(mathNode, logLabel),
                () => extractFromTextContent(mathNode),
            ];

            for (const strategy of strategies) {
                try {
                    const result = strategy();
                    if (result && validateLatex(result.latex, logLabel)) return result;
                } catch (error) {
                    logger.warn(`[AI-MarkDone][${logLabel}] LaTeX strategy failed`, error);
                }
            }

            logger.error(`[AI-MarkDone][${logLabel}] All LaTeX strategies failed`);
            return { latex: mathNode.outerHTML, isBlock: isBlockMath(mathNode) };
        },
        getCodeLanguage(codeBlock: HTMLElement): string {
            const classList = Array.from(codeBlock.classList);
            const langClass = classList.find((cls) => cls.startsWith('language-'));
            if (langClass) {
                return langClass.replace('language-', '');
            }

            return codeBlock.getAttribute('data-language') || '';
        },
        isBlockMath,
    };
}
