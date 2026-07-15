export type FormulaSvgAsset = {
    source: string;
    displayMode: boolean;
    fontSizePx: number;
    width: number;
    height: number;
    viewBox: string;
    svg: string;
};

export type FormulaMathmlAsset = {
    source: string;
    displayMode: boolean;
    mathml: string;
};

export type FormulaSource =
    | { kind: 'tex'; value: string; confidence: 'authoritative' }
    | { kind: 'dom-only'; sourceElement: Element };
