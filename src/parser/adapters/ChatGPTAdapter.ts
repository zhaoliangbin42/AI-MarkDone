/**
 * ChatGPT Platform Adapter
 * 
 * Handles ChatGPT-specific HTML structure and extraction logic
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 2: 5-Strategy LaTeX Extraction MANDATORY
 * @see Syntax-Mapping-Spec.md - ChatGPT Selectors & LaTeX Extraction
 */

import type { IPlatformAdapter, LatexResult } from './IPlatformAdapter';
import { decodeEntities } from '../utils/entities';
import { logger } from '../../utils/logger';

export class ChatGPTAdapter implements IPlatformAdapter {
    readonly name = 'ChatGPT';

    /**
     * Select all math nodes (both inline and block)
     */
    selectMathNodes(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('.katex, .katex-display'));
    }

    /**
     * Select all code blocks
     */
    selectCodeBlocks(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('pre > code'));
    }

    /**
     * Extract LaTeX using 5-strategy fallback chain
     * 
     * MANDATORY Strategy Order (DEVELOPER-REFERENCE-MANUAL Rule 2):
     * 1. <annotation encoding="application/x-tex">
     * 2. data-latex-source / data-math attributes
     * 3. katex-error recovery with entity decode
     * 4. MathML parsing
     * 5. textContent fallback
     * 
     * @param mathNode - Math element
     * @returns LaTeX result or null
     */
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
                if (result && this.validateLatex(result.latex)) {
                    return result;
                }
            } catch (error) {
                logger.warn(
                    `[ChatGPTAdapter] LaTeX extraction strategy failed:`,
                    strategy.name,
                    error
                );
                continue;
            }
        }

        // Ultimate fallback: preserve HTML
        logger.error('[ChatGPTAdapter] All LaTeX strategies failed for node', mathNode);
        return {
            latex: mathNode.outerHTML,
            isBlock: this.isBlockMath(mathNode),
        };
    }

    /**
     * Strategy 1: Extract from <annotation> tag
     * 
     * Highest priority, most reliable
     */
    private extractFromAnnotation(mathNode: HTMLElement): LatexResult | null {
        const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
        if (!annotation) {
            return null;
        }

        const latex = annotation.textContent?.trim();
        if (!latex) {
            return null;
        }

        return {
            latex,
            isBlock: this.isBlockMath(mathNode),
        };
    }

    /**
     * Strategy 2: Extract from data attributes
     */
    private extractFromDataAttribute(mathNode: HTMLElement): LatexResult | null {
        const latex =
            mathNode.getAttribute('data-latex-source') ||
            mathNode.getAttribute('data-math');

        if (!latex) {
            return null;
        }

        return {
            latex: latex.trim(),
            isBlock: this.isBlockMath(mathNode),
        };
    }

    /**
   * Strategy 3: Recover from katex-error
     * 
     * CRITICAL: Must decode HTML entities (DEVELOPER-REFERENCE-MANUAL Rule 5)
     * Verified against ChatGPT-DeepResearch.html L1202
     */
    private extractFromKatexError(mathNode: HTMLElement): LatexResult | null {
        const errorElement = mathNode.querySelector('.katex-error');
        if (!errorElement) {
            return null;
        }

        let text = errorElement.textContent?.trim() || '';
        if (!text) {
            return null;
        }

        // CRITICAL: Decode entities (& amp; → &)
        text = decodeEntities(text);

        // Remove "ParseError:" prefix if present
        text = text.replace(/^ParseError:.*?:\s*/i, '').trim();

        if (!text) {
            return null;
        }

        return {
            latex: text,
            isBlock: text.includes('\\begin{') || this.isBlockMath(mathNode),
        };
    }

    /**
     * Strategy 4: Parse MathML
     * 
     * Simplified MathML → LaTeX converter
     * @see Syntax-Mapping-Spec.md - MathML Fallback Table
     */
    private extractFromMathML(mathNode: HTMLElement): LatexResult | null {
        const math = mathNode.querySelector('math');
        if (!math) {
            return null;
        }

        try {
            const latex = this.mathMLToLatex(math);
            if (!latex) {
                return null;
            }

            return {
                latex,
                isBlock: this.isBlockMath(mathNode),
            };
        } catch (error) {
            logger.warn('[ChatGPTAdapter] MathML parsing failed:', error);
            return null;
        }
    }

    /**
     * Strategy 5: Last resort - raw textContent
     */
    private extractFromTextContent(mathNode: HTMLElement): LatexResult | null {
        const text = mathNode.textContent?.trim();
        if (!text || text.length === 0) {
            return null;
        }

        return {
            latex: text,
            isBlock: this.isBlockMath(mathNode),
        };
    }

    /**
     * Convert MathML to LaTeX (simplified)
     * 
     * Handles basic MathML tags: mi, mn, mo, msub, msup, mfrac, msqrt, mrow
     */
    private mathMLToLatex(element: Element): string {
        const tag = element.tagName.toLowerCase();

        switch (tag) {
            case 'mi':
            case 'mn':
            case 'mo':
                return element.textContent || '';

            case 'mrow':
                return Array.from(element.children)
                    .map(child => this.mathMLToLatex(child))
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
                    .map(child => this.mathMLToLatex(child))
                    .join(' ');
                return `\\sqrt{${content}}`;
            }

            case 'mtext':
                return `\\text{${element.textContent || ''}}`;

            case 'math':
                return Array.from(element.children)
                    .map(child => this.mathMLToLatex(child))
                    .join(' ');

            default:
                // Unknown tag: try to process children
                return Array.from(element.children)
                    .map(child => this.mathMLToLatex(child))
                    .join(' ');
        }
    }

    /**
     * Validate LaTeX for security and sanity
     * 
     * @see DEVELOPER-REFERENCE-MANUAL.md - validateLatex() requirements
     */
    private validateLatex(latex: string): boolean {
        if (!latex || latex.trim().length === 0) {
            return false;
        }

        // Too long = likely malformed
        if (latex.length > 10000) {
            logger.warn('[ChatGPTAdapter] LaTeX too long:', latex.length);
            return false;
        }

        // XSS attempt
        if (latex.includes('<script>')) {
            logger.error('[ChatGPTAdapter] XSS attempt detected in LaTeX');
            return false;
        }

        return true;
    }

    /**
     * Get programming language from code block
     */
    getCodeLanguage(codeBlock: HTMLElement): string {
        // ChatGPT uses class="language-python" pattern
        const classList = Array.from(codeBlock.classList);
        const langClass = classList.find(cls => cls.startsWith('language-'));

        if (langClass) {
            return langClass.replace('language-', '');
        }

        // Fallback: check data-language attribute
        return codeBlock.getAttribute('data-language') || '';
    }

    /**
     * Determine if math node is block-level
     */
    isBlockMath(mathNode: HTMLElement): boolean {
        return (
            mathNode.classList.contains('katex-display') ||
            mathNode.closest('.katex-display') !== null
        );
    }

    /**
     * Optional: Platform-specific text cleaning
     */
    cleanText(text: string): string {
        //ChatGPT-specific cleaning if needed
        return text;
    }
}
