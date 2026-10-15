import { MAX_HIGHLIGHT_FRAGMENTS, type HighlightTextFragment } from '../../contracts/highlights';
import { hasPartialRenderedInlineUnitSelection } from './atomicSelection';

export type HighlightSkipElement = (element: Element) => boolean;
const EXCLUDED = 'pre,.reader-code-block,[data-aimd-rich-block],[data-markdown-copy="code-block"],[data-markdown-copy="exclude"],[contenteditable]:not([contenteditable="false"]),input,textarea,[role="textbox"],img,svg,canvas,iframe,button,[role="button"],[data-testid="chatgpt-citation"],[data-testid="webpage-citation-pill"],[data-aimd-role],.sr-only,script,style,noscript';
const MATH = '.katex,.katex-display,[data-aimd-unit-kind="inline-math"],[data-aimd-unit-kind="display-math"]';
const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th';
const MAX_NODES = 5_000;
const MAX_TEXT = 100_000;

function excluded(element: Element, skip?: HighlightSkipElement): boolean {
    return element.matches(EXCLUDED) || Boolean(skip?.(element));
}

/** DOM-only admission. Copy retains its independent strict source policy. */
export function readHighlightSelection(range: Range, root: HTMLElement, skip?: HighlightSkipElement): { ranges: Range[]; segmented: boolean } | null {
    if (range.collapsed || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const ancestor = range.commonAncestorContainer;
    const scope = ancestor instanceof Element ? ancestor : ancestor.parentElement;
    if (!scope || !root.contains(scope)) return null;
    for (let parent: Element | null = scope; parent && root.contains(parent); parent = parent.parentElement) if (excluded(parent, skip)) return null;
    let segmented = Boolean(scope.closest('table')); let visited = 0; let overflow = false;
    const ranges: Range[] = []; let previousBlock: Element | null = null; let current: Range | null = null;
    const visit = (node: Node): void => {
        if (++visited > MAX_NODES) { overflow = true; return; }
        if (!range.intersectsNode(node)) return;
        if (node instanceof Element) {
            if (excluded(node, skip)) { segmented = true; current = null; return; }
            if (node.matches('table')) segmented = true;
            // Standalone complete formulas keep the existing indivisible path.
            if (node.matches(MATH)) { current = null; return; }
            node.childNodes.forEach(visit); return;
        }
        if (!(node instanceof Text)) return;
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.length;
        if (!node.data.slice(start, end).trim()) return;
        const block = node.parentElement?.closest(BLOCK) ?? root;
        if (!current || block !== previousBlock) {
            current = root.ownerDocument.createRange(); current.setStart(node, start); current.setEnd(node, end);
            ranges.push(current); previousBlock = block;
        } else current.setEnd(node, end);
    };
    visit(scope);
    if (overflow || ranges.length > MAX_HIGHLIGHT_FRAGMENTS) return null;
    if (!segmented) return hasPartialRenderedInlineUnitSelection(range, root) ? null : { ranges: [range.cloneRange()], segmented: false };
    return ranges.length ? { ranges, segmented: true } : null;
}

export function isHighlightableTextSelection(range: Range, root: HTMLElement, skip?: HighlightSkipElement): boolean {
    return readHighlightSelection(range, root, skip) !== null;
}

type TextEntry = { node: Text; start: number; text: string; offsets: number[] };
function textIndex(root: HTMLElement, skip?: HighlightSkipElement): { text: string; entries: TextEntry[] } | null {
    let visited = 0; let text = ''; let overflow = false;
    const entries: TextEntry[] = [];
    const visit = (node: Node): void => {
        if (++visited > MAX_NODES || text.length > MAX_TEXT) { overflow = true; return; }
        if (node instanceof Element) {
            if (excluded(node, skip) || node.matches(MATH)) return;
            node.childNodes.forEach(visit);
        } else if (node instanceof Text) {
            if (node.length > MAX_TEXT - text.length) { overflow = true; return; }
            const offsets: number[] = [];
            for (let index = 0; index < node.length; index++) if (!/\s/u.test(node.data[index]!)) offsets.push(index);
            const value = offsets.map(index => node.data[index]).join('');
            if (value) { entries.push({ node, start: text.length, text: value, offsets }); text += value; }
        }
    };
    visit(root);
    return overflow || text.length > MAX_TEXT ? null : { text, entries };
}

/** Only selected text persists, on a whitespace-independent filtered message axis. */
export function captureHighlightTextFragments(root: HTMLElement, ranges: readonly Range[], skip?: HighlightSkipElement): HighlightTextFragment[] | null {
    const index = textIndex(root, skip);
    if (!index || !ranges.length || ranges.length > MAX_HIGHLIGHT_FRAGMENTS) return null;
    const fragments: HighlightTextFragment[] = [];
    for (const range of ranges) {
        const selected = index.entries.filter(entry => range.intersectsNode(entry.node));
        const first = selected[0]; const last = selected[selected.length - 1];
        if (!first || !last) return null;
        const localStart = first.node === range.startContainer ? range.startOffset : 0;
        const localEnd = last.node === range.endContainer ? range.endOffset : last.node.length;
        const start = first.start + first.offsets.filter(offset => offset < localStart).length;
        const end = last.start + last.offsets.filter(offset => offset < localEnd).length;
        const exact = index.text.slice(start, end);
        if (!exact) return null;
        fragments.push({ quoteText: range.toString().trim(), selectors: {
            textQuote: { exact, prefix: index.text.slice(Math.max(0, start - 50), start), suffix: index.text.slice(end, end + 50) },
            textPosition: { start, end }, domRange: null, atomicRefs: [],
        } });
    }
    return resolveHighlightTextFragments(root, fragments, skip) ? fragments : null;
}

/** Every fragment must resolve uniquely and in order; offsets alone are never proof. */
export function resolveHighlightTextFragments(root: HTMLElement, fragments: readonly HighlightTextFragment[], skip?: HighlightSkipElement): Range[] | null {
    const index = textIndex(root, skip);
    if (!index || !fragments.length || fragments.length > MAX_HIGHLIGHT_FRAGMENTS) return null;
    const ranges: Range[] = []; let previousEnd = 0;
    for (const fragment of fragments) {
        const { exact, prefix, suffix } = fragment.selectors.textQuote;
        if (!exact || fragment.quoteText.replace(/\s/gu, '') !== exact) return null;
        const matches: number[] = [];
        for (let from = 0; from <= index.text.length;) {
            const at = index.text.indexOf(exact, from); if (at < 0) break;
            if ((!prefix || index.text.slice(0, at).endsWith(prefix)) && (!suffix || index.text.slice(at + exact.length).startsWith(suffix))) matches.push(at);
            if (matches.length > 1) return null;
            from = at + 1;
        }
        if (matches.length !== 1 || matches[0]! < previousEnd) return null;
        const start = matches[0]!; const end = start + exact.length; previousEnd = end;
        for (const entry of index.entries) {
            const left = Math.max(start, entry.start); const right = Math.min(end, entry.start + entry.text.length);
            if (right <= left) continue;
            const range = root.ownerDocument.createRange();
            range.setStart(entry.node, entry.offsets[left - entry.start]!);
            range.setEnd(entry.node, entry.offsets[right - entry.start - 1]! + 1);
            ranges.push(range);
        }
    }
    return ranges.length ? ranges : null;
}
