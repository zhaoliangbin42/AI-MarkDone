import { MAX_HIGHLIGHT_FORMULA_LENGTH, MAX_HIGHLIGHT_FRAGMENTS, type HighlightTextFragment } from '../../contracts/highlights';
import { extractAuthoritativeLatexSource } from '../../core/latex/extractLatexSource';
import { hasPartialRenderedInlineUnitSelection, isCompleteRenderedFormulaSelected } from './atomicSelection';

export type HighlightSkipElement = (element: Element) => boolean;
const EXCLUDED = 'pre,.reader-code-block,[data-aimd-rich-block],[data-markdown-copy="code-block"],[data-markdown-copy="exclude"],[contenteditable]:not([contenteditable="false"]),input,textarea,[role="textbox"],img,svg,canvas,iframe,button,[role="button"],[data-testid="chatgpt-citation"],[data-testid="webpage-citation-pill"],[data-aimd-role],.sr-only,script,style,noscript';
const MATH = '.katex,.katex-display,[data-aimd-unit-kind="inline-math"],[data-aimd-unit-kind="display-math"]';
const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th';
const MAX_NODES = 5_000;
const MAX_TEXT = 100_000;

function excluded(element: Element, skip?: HighlightSkipElement): boolean {
    return element.matches(EXCLUDED) || Boolean(skip?.(element));
}

function mathOwner(node: Node): HTMLElement | null {
    let owner = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(MATH) ?? null;
    let parent: HTMLElement | null;
    while (owner && (parent = owner.parentElement?.closest<HTMLElement>(MATH) ?? null)) owner = parent;
    return owner;
}

function formulaOf(element: HTMLElement): HighlightTextFragment['formula'] | undefined {
    const latex = extractAuthoritativeLatexSource(element);
    return latex && latex.length <= MAX_HIGHLIGHT_FORMULA_LENGTH ? { latex, display: element.matches('.katex-display,[data-aimd-unit-kind="display-math"]') } : undefined;
}

function formulaQuote(formula: NonNullable<HighlightTextFragment['formula']>): string {
    return formula.display ? `$$\n${formula.latex}\n$$` : `$${formula.latex}$`;
}

/** One eligibility policy, with bounded full capture only when the user saves. */
function inspectHighlightSelection(range: Range, root: HTMLElement, skip: HighlightSkipElement | undefined, availability: boolean): { ranges: Range[]; segmented: boolean } | null {
    if (range.collapsed || !root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const ancestor = range.commonAncestorContainer;
    const scope = mathOwner(ancestor) ?? (ancestor instanceof Element ? ancestor : ancestor.parentElement);
    if (!scope || !root.contains(scope)) return null;
    for (let parent: Element | null = scope; parent && root.contains(parent); parent = parent.parentElement) if (excluded(parent, skip)) return null;
    let segmented = Boolean(scope.closest('table')); let visited = 0; let overflow = false; let hasMath = false;
    const ranges: Range[] = []; let previousBlock: Element | null = null; let current: Range | null = null;
    const visit = (node: Node): void => {
        if (++visited > MAX_NODES) { overflow = true; return; }
        if (!range.intersectsNode(node)) return;
        if (node instanceof Element) {
            if (excluded(node, skip)) { segmented = true; current = null; return; }
            if (node.matches('table')) segmented = true;
            // Formula identity comes from source, so glyph wrappers cannot change the mark.
            if (node instanceof HTMLElement && node.matches(MATH)) {
                hasMath = true; current = null;
                const complete = isCompleteRenderedFormulaSelected(range, node);
                if (complete && formulaOf(node)) {
                    segmented = true;
                    const formulaRange = root.ownerDocument.createRange(); formulaRange.selectNodeContents(node); ranges.push(formulaRange);
                } else if (!complete) segmented = true;
                return;
            }
            for (const child of node.childNodes) {
                visit(child);
                if (overflow || (availability && ranges.length > 0)) break;
            }
            return;
        }
        if (!(node instanceof Text)) return;
        // The common ancestor can be inside math when an endpoint selects a glyph.
        if (node.parentElement?.closest(MATH)) { hasMath = true; current = null; return; }
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
    if (availability && ranges.length > 0) return { ranges, segmented };
    if (overflow || ranges.length > MAX_HIGHLIGHT_FRAGMENTS) return null;
    if (!segmented && !hasPartialRenderedInlineUnitSelection(range, root)) {
        return ranges.length || hasMath ? { ranges: [range.cloneRange()], segmented: false } : null;
    }
    return ranges.length ? { ranges, segmented: true } : null;
}

/** Copy retains its independent strict source policy; capture never truncates. */
export function readHighlightSelection(range: Range, root: HTMLElement, skip?: HighlightSkipElement): { ranges: Range[]; segmented: boolean } | null {
    return inspectHighlightSelection(range, root, skip, false);
}

export function isHighlightableTextSelection(range: Range, root: HTMLElement, skip?: HighlightSkipElement): boolean {
    return inspectHighlightSelection(range, root, skip, true) !== null;
}

type TextEntry = { node: Text; start: number; text: string; offsets: number[] };
type FormulaEntry = { element: HTMLElement; position: number; formula: NonNullable<HighlightTextFragment['formula']> };
function textIndex(root: HTMLElement, skip?: HighlightSkipElement): { text: string; entries: TextEntry[]; formulas: FormulaEntry[] } | null {
    let visited = 0; let text = ''; let overflow = false;
    const entries: TextEntry[] = [];
    const formulas: FormulaEntry[] = [];
    const visit = (node: Node): void => {
        if (++visited > MAX_NODES || text.length > MAX_TEXT) { overflow = true; return; }
        if (node instanceof Element) {
            if (excluded(node, skip)) return;
            if (node instanceof HTMLElement && node.matches(MATH)) {
                const formula = formulaOf(node);
                if (formula) formulas.push({ element: node, position: text.length, formula });
                return;
            }
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
    return overflow || text.length > MAX_TEXT ? null : { text, entries, formulas };
}

/** Persist supported text and whole formulas; existing text-axis selectors stay unchanged. */
export function captureHighlightTextFragments(root: HTMLElement, ranges: readonly Range[], skip?: HighlightSkipElement): HighlightTextFragment[] | null {
    const index = textIndex(root, skip);
    if (!index || !ranges.length || ranges.length > MAX_HIGHLIGHT_FRAGMENTS) return null;
    const fragments: HighlightTextFragment[] = [];
    for (const range of ranges) {
        const math = mathOwner(range.commonAncestorContainer);
        if (math) {
            const entry = index.formulas.find(candidate => candidate.element === math);
            if (!entry || !isCompleteRenderedFormulaSelected(range, math)) return null;
            fragments.push({ quoteText: formulaQuote(entry.formula), formula: entry.formula, selectors: {
                textQuote: { exact: entry.formula.latex, prefix: index.text.slice(Math.max(0, entry.position - 50), entry.position), suffix: index.text.slice(entry.position, entry.position + 50) },
                textPosition: { start: entry.position, end: entry.position }, domRange: null, atomicRefs: [],
            } });
            continue;
        }
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
export function resolveHighlightFragments(root: HTMLElement, fragments: readonly HighlightTextFragment[], skip?: HighlightSkipElement): { ranges: Range[]; textRanges: Range[]; units: { element: HTMLElement }[] } | null {
    const index = textIndex(root, skip);
    if (!index || !fragments.length || fragments.length > MAX_HIGHLIGHT_FRAGMENTS) return null;
    const ranges: Range[] = []; const textRanges: Range[] = []; const units: { element: HTMLElement }[] = []; let previousEnd = 0;
    for (const fragment of fragments) {
        const { exact, prefix, suffix } = fragment.selectors.textQuote;
        if (fragment.formula) {
            if (exact !== fragment.formula.latex || fragment.quoteText !== formulaQuote(fragment.formula)) return null;
            const candidates = index.formulas.filter(entry => entry.formula.latex === fragment.formula!.latex && entry.formula.display === fragment.formula!.display
                && (!prefix || index.text.slice(0, entry.position).endsWith(prefix)) && (!suffix || index.text.slice(entry.position).startsWith(suffix)));
            if (candidates.length !== 1 || candidates[0]!.position < previousEnd) return null;
            const entry = candidates[0]!; previousEnd = entry.position;
            const range = root.ownerDocument.createRange(); range.selectNodeContents(entry.element);
            ranges.push(range); units.push({ element: entry.element });
            continue;
        }
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
            textRanges.push(range);
        }
    }
    return ranges.length ? { ranges, textRanges, units } : null;
}

/** Compatibility view for consumers that only need the ordered navigation ranges. */
export function resolveHighlightTextFragments(root: HTMLElement, fragments: readonly HighlightTextFragment[], skip?: HighlightSkipElement): Range[] | null {
    return resolveHighlightFragments(root, fragments, skip)?.ranges ?? null;
}
