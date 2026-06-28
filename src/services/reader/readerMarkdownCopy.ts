import { copyTextToClipboard } from '../../drivers/content/clipboard/clipboard';
import {
    DEFAULT_FORMULA_SOURCE_FORMAT,
    normalizeFormulaSourceFormat,
    rewriteMarkdownFormulaSources,
    type FormulaSourceFormat,
} from '../../core/math/formulaSourceFormat';
import { resolveContent, type ReaderItem } from './types';

let markdownCopyFormulaFormat: FormulaSourceFormat = DEFAULT_FORMULA_SOURCE_FORMAT;

export function setReaderMarkdownCopyFormulaFormat(format: FormulaSourceFormat): void {
    markdownCopyFormulaFormat = normalizeFormulaSourceFormat(format);
}

export function formatReaderMarkdownForCopy(markdown: string): string {
    return rewriteMarkdownFormulaSources(markdown, markdownCopyFormulaFormat);
}

export async function resolveReaderItemMarkdown(item: ReaderItem): Promise<string> {
    return resolveContent(item.content);
}

export async function copyReaderItemMarkdownToClipboard(item: ReaderItem): Promise<boolean> {
    const markdown = await resolveContent(item.content);
    return copyTextToClipboard(formatReaderMarkdownForCopy(markdown));
}
