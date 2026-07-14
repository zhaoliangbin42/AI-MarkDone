import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { extractLatexSource } from '../../core/latex/extractLatexSource';
import { formatReaderMarkdownForCopy } from '../reader/readerMarkdownCopy';
import { buildAtomicSelectionExport } from '../reader/atomicExport';
import type { RenderedAtomicUnit, SelectedAtomicUnit } from '../reader/atomicSelection';
import { copyMarkdownFromElement } from './copy-markdown';

const DEFAULT_MAX_PROCESSING_TIME_MS = 32;
const DEFAULT_MAX_NODE_COUNT = 5_000;

export function buildPageAtomicSelectionMarkdown(params: {
    adapter: SiteAdapter;
    range: Range;
    root: HTMLElement;
    selectedUnits: RenderedAtomicUnit[];
    maxProcessingTimeMs?: number;
    maxNodeCount?: number;
}): string | null {
    const {
        adapter,
        range,
        root,
        selectedUnits,
        maxProcessingTimeMs = DEFAULT_MAX_PROCESSING_TIME_MS,
        maxNodeCount = DEFAULT_MAX_NODE_COUNT,
    } = params;
    if (selectedUnits.length === 0) return null;

    const startedAt = performance.now();
    let remainingNodes = maxNodeCount;
    const resolved: SelectedAtomicUnit[] = [];

    for (const [index, unit] of selectedUnits.entries()) {
        const nodeCount = countSubtreeNodes(unit.element, remainingNodes);
        remainingNodes -= nodeCount;
        const remainingTime = maxProcessingTimeMs - (performance.now() - startedAt);
        if (remainingNodes < 0 || remainingTime <= 0) return null;

        const source = serializeAtomicUnit(adapter, unit, {
            maxProcessingTimeMs: remainingTime,
            maxNodeCount: Math.max(1, remainingNodes + nodeCount),
        });
        if (!source?.trim()) return null;
        resolved.push({
            id: `aimd-page-unit-${index + 1}`,
            kind: unit.kind,
            mode: unit.mode,
            start: index,
            end: index + 1,
            source: source.trim(),
            element: unit.element,
        });
        if (performance.now() - startedAt > maxProcessingTimeMs) return null;
    }

    const markdown = buildAtomicSelectionExport({
        range,
        root,
        selectedUnits: resolved,
        shouldSkipElement: (element) => shouldSkipElement(adapter, element),
    });
    if (!markdown || performance.now() - startedAt > maxProcessingTimeMs) return null;
    return formatReaderMarkdownForCopy(markdown);
}

function serializeAtomicUnit(
    adapter: SiteAdapter,
    unit: RenderedAtomicUnit,
    options: { maxProcessingTimeMs: number; maxNodeCount: number },
): string | null {
    if (unit.kind === 'inline-math' || unit.kind === 'display-math') {
        const source = extractLatexSource(unit.element);
        if (!source) return null;
        return unit.kind === 'display-math'
            ? `$$\n${source}\n$$`
            : `$${source}$`;
    }
    if (unit.kind === 'image') {
        const image = unit.element as HTMLImageElement;
        const source = image.getAttribute('src')?.trim();
        if (!source) return null;
        const alt = image.getAttribute('alt') ?? '';
        return `![${alt}](${source})`;
    }
    const result = copyMarkdownFromElement(adapter, unit.element, options);
    if (!result.ok) return null;
    if (unit.kind !== 'list-item') return result.markdown;

    const marker = resolveListMarker(unit.element);
    const lines = result.markdown.trim().split('\n');
    const first = lines.shift()?.trim();
    if (!first) return null;
    const continuationIndent = ' '.repeat(marker.length + 1);
    const continuation = lines.map((line) => line ? `${continuationIndent}${line}` : '').join('\n');
    return continuation ? `${marker} ${first}\n${continuation}` : `${marker} ${first}`;
}

function resolveListMarker(element: HTMLElement): string {
    const parent = element.parentElement;
    if (!(parent instanceof HTMLOListElement)) return '-';
    const explicitValue = element.getAttribute('value');
    if (explicitValue && Number.isFinite(Number(explicitValue))) return `${Math.round(Number(explicitValue))}.`;
    const siblings = Array.from(parent.children).filter((child) => child.tagName === 'LI');
    const index = Math.max(0, siblings.indexOf(element));
    return `${parent.start + index}.`;
}

function countSubtreeNodes(root: HTMLElement, limit: number): number {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let count = 1;
    while (walker.nextNode()) {
        count += 1;
        if (count > limit) return count;
    }
    return count;
}

function shouldSkipElement(adapter: SiteAdapter, element: HTMLElement): boolean {
    if (element.matches('script, style, noscript, button, [role="button"], [data-aimd-role], .sr-only')) return true;
    try {
        return adapter.isNoiseNode(element, { nextSibling: element.nextElementSibling });
    } catch {
        return false;
    }
}
