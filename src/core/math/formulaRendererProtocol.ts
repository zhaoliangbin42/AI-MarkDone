import type { FormulaSvgAsset } from './formulaAssetTypes';

export const FORMULA_RENDERER_REQUEST_TYPE = 'aimd:formula-renderer:request';
export const FORMULA_RENDERER_RESPONSE_TYPE = 'aimd:formula-renderer:response';

export type FormulaRendererRequest = {
    type: typeof FORMULA_RENDERER_REQUEST_TYPE;
    id: string;
    source: string;
    displayMode: boolean;
    fontSizePx: number;
};

export type FormulaRendererSuccessResponse = {
    type: typeof FORMULA_RENDERER_RESPONSE_TYPE;
    id: string;
    ok: true;
    asset: FormulaSvgAsset;
};

export type FormulaRendererFailureResponse = {
    type: typeof FORMULA_RENDERER_RESPONSE_TYPE;
    id: string;
    ok: false;
    message: string;
};

export type FormulaRendererResponse = FormulaRendererSuccessResponse | FormulaRendererFailureResponse;

