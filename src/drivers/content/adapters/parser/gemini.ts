import { logger } from '../../../../core/logger';
import type { LatexResult, MarkdownParserAdapter } from './MarkdownParserAdapter';

function validateLatex(latex: string): boolean {
    if (!latex || latex.trim().length === 0) return false;
    if (latex.length > 50000) return false;
    if (latex.includes('<script>') || latex.includes('javascript:') || latex.includes('onerror=') || latex.includes('onload=')) {
        return false;
    }
    return true;
}

function isGeminiBlockMath(mathNode: HTMLElement): boolean {
    return mathNode.classList.contains('math-block') || mathNode.closest('.math-block') !== null;
}

export const geminiMarkdownParserAdapter: MarkdownParserAdapter = {
    name: 'Gemini',
    isMathNode(node: Element): boolean {
        const element = node as HTMLElement;
        const mathContainer = element.closest?.('[data-math]');
        if (mathContainer && mathContainer !== element) return false;
        return element.classList.contains('math-inline') || element.classList.contains('math-block');
    },
    isCodeBlockNode(node: Element): boolean {
        const element = node as HTMLElement;
        return (
            (element.tagName === 'PRE' && element.querySelector('code') !== null) ||
            element.classList.contains('code-container') ||
            (element.matches('code') && element.closest('.code-block') !== null)
        );
    },
    extractLatex(mathNode: HTMLElement): LatexResult | null {
        try {
            const mathContainer = mathNode.closest('[data-math]');
            if (mathContainer && mathContainer !== mathNode) return null;

            const dataMath = mathNode.getAttribute('data-math');
            if (dataMath && validateLatex(dataMath)) {
                return { latex: dataMath, isBlock: isGeminiBlockMath(mathNode) };
            }

            const katexHtml = mathNode.querySelector('.katex-html');
            const text = katexHtml?.textContent?.trim();
            if (text && validateLatex(text)) {
                logger.warn('[AI-MarkDone][GeminiParserAdapter] Fallback triggered: missing data-math');
                return { latex: text, isBlock: isGeminiBlockMath(mathNode) };
            }

            logger.warn('[AI-MarkDone][GeminiParserAdapter] All strategies failed, preserving HTML');
            return { latex: mathNode.outerHTML, isBlock: isGeminiBlockMath(mathNode) };
        } catch (error) {
            logger.error('[AI-MarkDone][GeminiParserAdapter] extractLatex failed', error);
            return { latex: mathNode.textContent || mathNode.outerHTML, isBlock: isGeminiBlockMath(mathNode) };
        }
    },
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
    },
    isBlockMath: isGeminiBlockMath,
};
