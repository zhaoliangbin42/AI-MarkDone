import type { HighlightTextFragment } from '../../contracts/highlights';
import type { ReaderCommentRecord, ReaderCommentSelectors } from './commentSession';
import { captureHighlightTextFragments, readHighlightSelection, type HighlightSkipElement } from './highlightSelection';

/** Page and Reader use one fragment format; legacy sources keep their existing compiler. */
export function createSelectionHighlightRecord(params: {
    id: string; itemId: string; range: Range; root: HTMLElement; skip?: HighlightSkipElement;
    legacyRecord: () => ReaderCommentRecord | null;
}): { record: ReaderCommentRecord; fragments?: HighlightTextFragment[] } | null {
    const selection = readHighlightSelection(params.range, params.root, params.skip);
    if (!selection) return null;
    if (!selection.segmented) {
        const record = params.legacyRecord();
        return record ? { record } : null;
    }
    const fragments = captureHighlightTextFragments(params.root, selection.ranges, params.skip);
    if (!fragments) return null;
    const quoteText = fragments.map(fragment => fragment.quoteText).join('\n\n');
    // This is a readable text excerpt, not the Copy action's Markdown projection.
    const sourceMarkdown = fragments.map(fragment => fragment.formula ? fragment.quoteText : fragment.quoteText.replace(/[\\`*_\[\]<>#$]/g, '\\$&')).join('\n\n');
    const now = Date.now();
    return { record: {
        id: params.id, itemId: params.itemId, quoteText, sourceMarkdown, comment: '',
        selectors: fragments[0]!.selectors as ReaderCommentSelectors, createdAt: now, updatedAt: now,
    }, fragments };
}
