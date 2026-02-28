export interface LatexResult {
    latex: string;
    isBlock: boolean;
}

export interface IPlatformAdapter {
    readonly name: string;

    selectMathNodes(root: HTMLElement): HTMLElement[];
    selectCodeBlocks(root: HTMLElement): HTMLElement[];
    extractLatex(mathNode: HTMLElement): LatexResult | null;
    getCodeLanguage(codeBlock: HTMLElement): string;
    isBlockMath(mathNode: HTMLElement): boolean;
    cleanText?(text: string): string;
    canHandle?(root: HTMLElement): number;
}

