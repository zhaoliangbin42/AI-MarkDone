/**
 * Platform Adapter Interface
 * 
 * Abstracts platform-specific HTML structure differences
 * @see DEVELOPER-REFERENCE-MANUAL.md - Document Hierarchy Priority 2
 * @see Syntax-Mapping-Spec.md - Platform-Specific Selectors
 */

export interface LatexResult {
    /** Extracted LaTeX code */
    latex: string;

    /** Whether this is a block-level formula ($$) or inline ($) */
    isBlock: boolean;
}

export interface IPlatformAdapter {
    /** Platform name (e.g., 'ChatGPT', 'Gemini') */
    readonly name: string;

    /**
     * Select all math formula nodes from root element
     * @param root - Root HTML element
     * @returns Array of math nodes
     */
    selectMathNodes(root: HTMLElement): HTMLElement[];

    /**
     * Select all code block nodes from root element
     * @param root - Root HTML element
     * @returns Array of code block elements
     */
    selectCodeBlocks(root: HTMLElement): HTMLElement[];

    /**
     * Extract LaTeX from math node using 5-strategy fallback
     * 
     * MANDATORY Strategy Order (DEVELOPER-REFERENCE-MANUAL Rule 2):
     * 1. <annotation encoding="application/x-tex">
     * 2. data-latex-source / data-math attributes
     * 3. katex-error recovery with entity decode
     * 4. MathML parsing
     * 5. textContent fallback
     * 
     * @param mathNode - HTML element containing math
     * @returns LaTeX result or null if extraction fails
     */
    extractLatex(mathNode: HTMLElement): LatexResult | null;

    /**
     * Get programming language from code block element
     * @param codeBlock - Code block element
     * @returns Language identifier (e.g., 'python') or empty string
     */
    getCodeLanguage(codeBlock: HTMLElement): string;

    /**
     * Determine if math node represents block-level formula
     * @param mathNode - Math element
     * @returns true if block math ($$), false if inline ($)
     */
    isBlockMath(mathNode: HTMLElement): boolean;

    /**
     * Platform-specific text cleaning (optional)
     * @param text - Raw text
     * @returns Cleaned text
     */
    cleanText?(text: string): string;

    /**
     * Runtime self-test: Can this adapter handle the current DOM?
     * @param root - Root element to check
     * @returns Confidence score 0-1 (optional)
     */
    canHandle?(root: HTMLElement): number;
}
