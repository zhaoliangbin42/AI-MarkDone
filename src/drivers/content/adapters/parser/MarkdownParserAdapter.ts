export interface LatexResult {
    latex: string;
    isBlock: boolean;
}

export interface MarkdownParserAdapter {
    readonly name: string;

    isMathNode(node: Element): boolean;
    isCodeBlockNode(node: Element): boolean;
    extractLatex(mathNode: HTMLElement): LatexResult | null;
    getCodeLanguage(codeBlock: HTMLElement): string;
    isBlockMath(mathNode: HTMLElement): boolean;
    cleanText?(text: string): string;
}
