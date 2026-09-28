import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    normalizeFormulaSourceFormat,
    rewriteMarkdownFormulaSources,
    type FormulaSourceFormat,
} from '../../core/math/formulaSourceFormat';
import { copyTextToClipboard } from '../../drivers/content/clipboard/clipboard';

let markdownCopyFormulaFormat: FormulaSourceFormat = DEFAULT_FORMULA_SOURCE_FORMAT;

export function setCanonicalMarkdownCopyFormulaFormat(format: FormulaSourceFormat): void {
    markdownCopyFormulaFormat = normalizeFormulaSourceFormat(format);
}

export function formatCanonicalMarkdownForCopy(markdown: string, literal = false): string {
    // Canonical Markdown already uses dollar-delimited math. Avoid reparsing the
    // synchronous default copy path unless the user requested another wrapper.
    if (literal || markdownCopyFormulaFormat === DEFAULT_FORMULA_SOURCE_FORMAT) return markdown;
    return rewriteMarkdownFormulaSources(markdown, markdownCopyFormulaFormat);
}

export function copyCanonicalMarkdownToClipboard(markdown: string, literal = false): Promise<boolean> {
    return copyTextToClipboard(formatCanonicalMarkdownForCopy(markdown, literal));
}
