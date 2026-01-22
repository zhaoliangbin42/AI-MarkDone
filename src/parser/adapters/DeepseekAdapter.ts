/**
 * Deepseek Platform Adapter (Parser)
 * 
 * Handles Deepseek-specific HTML structure for code blocks and LaTeX
 * 
 * Key differences from ChatGPT:
 * - Code blocks use <pre> directly without <code> wrapper
 * - Language is in .md-code-block-banner span.d813de27
 */

import type { IPlatformAdapter, LatexResult } from './IPlatformAdapter';

export class DeepseekAdapter implements IPlatformAdapter {
    readonly name = 'Deepseek';

    /**
     * Select all math nodes (using KaTeX)
     */
    selectMathNodes(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('.katex, .katex-display'));
    }

    /**
     * Select all code blocks
     * Deepseek uses .md-code-block > pre (without <code> wrapper)
     */
    selectCodeBlocks(root: HTMLElement): HTMLElement[] {
        return Array.from(root.querySelectorAll('.md-code-block pre, pre > code'));
    }

    /**
     * Extract LaTeX from math node
     * Similar to ChatGPT - uses annotation tag
     */
    extractLatex(mathNode: HTMLElement): LatexResult | null {
        // Strategy 1: annotation tag
        const annotation = mathNode.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation?.textContent) {
            return {
                latex: annotation.textContent.trim(),
                isBlock: this.isBlockMath(mathNode),
            };
        }

        // Strategy 2: data-math attribute
        const dataMath = mathNode.getAttribute('data-math');
        if (dataMath) {
            return {
                latex: dataMath.trim(),
                isBlock: this.isBlockMath(mathNode),
            };
        }

        // Strategy 3: textContent fallback
        const text = mathNode.textContent?.trim();
        if (text) {
            return {
                latex: text,
                isBlock: this.isBlockMath(mathNode),
            };
        }

        return null;
    }

    /**
     * Get programming language from code block
     * 
     * Deepseek structure:
     * <div class="md-code-block">
     *   <div class="md-code-block-banner-wrap">
     *     <span class="d813de27">python</span>  <!-- language here -->
     *   </div>
     *   <pre>code content...</pre>
     * </div>
     */
    getCodeLanguage(codeBlock: HTMLElement): string {
        // If it's a <pre> element, find parent .md-code-block and look for language
        const mdCodeBlock = codeBlock.closest('.md-code-block');
        if (mdCodeBlock) {
            // Language is in span.d813de27 within the banner
            const langSpan = mdCodeBlock.querySelector('.d813de27');
            if (langSpan?.textContent) {
                return langSpan.textContent.trim();
            }
        }

        // Fallback: check for class="language-xxx" pattern
        const classList = Array.from(codeBlock.classList);
        const langClass = classList.find(cls => cls.startsWith('language-'));
        if (langClass) {
            return langClass.replace('language-', '');
        }

        return '';
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
     * Platform-specific text cleaning
     */
    cleanText(text: string): string {
        return text;
    }
}
