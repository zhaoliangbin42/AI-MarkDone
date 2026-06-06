import { logger } from '../../core/logger';
import { createKatexMarkdownParserAdapter } from '../../drivers/content/adapters/parser/katex';
import type { LatexResult, MarkdownParserAdapter } from '../../drivers/content/adapters/parser/MarkdownParserAdapter';
import type { FormulaOnlyPlatformId } from './formulaOnlyRuntime';

function validateGeminiLatex(latex: string): boolean {
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

const geminiFormulaParserAdapter: MarkdownParserAdapter = {
    name: 'Gemini',
    isMathNode(node: Element): boolean {
        const element = node as HTMLElement;
        const mathContainer = element.closest?.('[data-math]');
        if (mathContainer && mathContainer !== element) return false;
        return element.classList.contains('math-inline') || element.classList.contains('math-block');
    },
    isCodeBlockNode(): boolean {
        return false;
    },
    extractLatex(mathNode: HTMLElement): LatexResult | null {
        try {
            const mathContainer = mathNode.closest('[data-math]');
            if (mathContainer && mathContainer !== mathNode) return null;

            const dataMath = mathNode.getAttribute('data-math');
            if (dataMath && validateGeminiLatex(dataMath)) {
                return { latex: dataMath, isBlock: isGeminiBlockMath(mathNode) };
            }

            const katexHtml = mathNode.querySelector('.katex-html');
            const text = katexHtml?.textContent?.trim();
            if (text && validateGeminiLatex(text)) {
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
    getCodeLanguage(): string {
        return '';
    },
    isBlockMath: isGeminiBlockMath,
};

function isDeepseekBlockMath(mathNode: HTMLElement): boolean {
    return mathNode.classList.contains('katex-display') || mathNode.closest('.katex-display') !== null;
}

const deepseekFormulaParserAdapter: MarkdownParserAdapter = {
    name: 'Deepseek',
    isMathNode(node: Element): boolean {
        const element = node as HTMLElement;
        const mathContainer = element.closest?.('[data-math]');
        if (mathContainer && mathContainer !== element) return false;
        return element.classList.contains('katex') || element.classList.contains('katex-display');
    },
    isCodeBlockNode(): boolean {
        return false;
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
    getCodeLanguage(): string {
        return '';
    },
    isBlockMath: isDeepseekBlockMath,
    cleanText(text: string): string {
        return text;
    },
};

const claudeFormulaParserAdapter = createKatexMarkdownParserAdapter('Claude', 'ClaudeParserAdapter');

export function getFormulaPlatformParserAdapter(platformId: FormulaOnlyPlatformId): MarkdownParserAdapter {
    switch (platformId) {
        case 'gemini':
            return geminiFormulaParserAdapter;
        case 'claude':
            return claudeFormulaParserAdapter;
        case 'deepseek':
            return deepseekFormulaParserAdapter;
    }
}
