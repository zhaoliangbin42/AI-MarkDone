import {
    createRichContentUrl,
    freezeRichBlocks,
    isRichBlocksV1,
    type RichBlockKindV1,
    type RichBlockSourceV1,
    type RichBlockV1,
} from '../../../contracts/richContent';
import { sanitizeLightweightSvg } from '../export/sanitizeLightweightSvg';

export { sanitizeLightweightSvg } from '../export/sanitizeLightweightSvg';

export type ChatGPTRichBlockSurface = Readonly<{ element: Element; block: RichBlockV1 }>;

const EXCLUDED_OWNER_SELECTORS = [
    'pre', 'code', 'math', '.katex', '.katex-display', 'button', '[role="button"]',
    '[data-markdown-copy="code-block"]', '[data-markdown-copy="inline-code"]',
    '[data-markdown-copy="exclude"]', '[data-aimd-role]', '[aria-hidden="true"]',
    '[data-d-component="icon"]', '[data-d-component="favicon"]', '[data-testid="webpage-citation-pill"]',
];
const EXCLUDED_OWNER = EXCLUDED_OWNER_SELECTORS.join(',');
const VISUAL_MUTATION_EXCLUDED_OWNER = EXCLUDED_OWNER_SELECTORS
    .filter(selector => selector !== '[aria-hidden="true"]').join(',');
const CHART_SELECTOR = '[data-testid="chatgpt-chart-content-reference"]';

function hash(value: string): string {
    let first = 2166136261;
    let second = 5381;
    for (let index = 0; index < value.length; index += 1) {
        first = Math.imul(first ^ value.charCodeAt(index), 16777619);
        second = Math.imul(second, 33) ^ value.charCodeAt(index);
    }
    return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function textOf(element: Element): string {
    const accessibleRows = element.matches(CHART_SELECTOR)
        ? Array.from(element.querySelectorAll('ul.sr-only > li, ol.sr-only > li')) : [];
    if (accessibleRows.length) return accessibleRows.map(row => row.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean).join('; ').slice(0, 30_000);
    const readable = element.cloneNode(true) as Element;
    for (const formula of Array.from(readable.querySelectorAll('.katex'))) {
        const tex = formula.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
        if (tex) formula.replaceWith(readable.ownerDocument.createTextNode(`$${tex}$`));
    }
    const walker = readable.ownerDocument.createTreeWalker(readable, 4);
    const parts: string[] = [];
    let text: Node | null;
    while ((text = walker.nextNode())) {
        if (text.parentElement?.closest('button, [role="button"], script, style, [data-d-component="icon"], [data-d-component="favicon"]')) continue;
        const value = text.textContent?.replace(/\s+/g, ' ').trim();
        if (value) parts.push(value);
    }
    return parts.join(' ').slice(0, 30_000);
}

function labelOf(element: Element, kind: RichBlockKindV1): string {
    const captionOwner = element.closest('figure, [data-d-component="box"]');
    const caption = captionOwner?.querySelector('figcaption, [data-d-component="caption"]')?.textContent;
    const explicit = caption || element.getAttribute('alt') || element.getAttribute('title')
        || element.getAttribute('aria-label') || element.querySelector('svg > title, :scope > title')?.textContent;
    const fallback = { svg: 'Diagram', image: 'Image', canvas: 'Canvas', html: 'Chart or card', embed: 'Embedded content', unknown: 'Dynamic content' };
    return (explicit?.replace(/\s+/g, ' ').trim() || fallback[kind]).slice(0, 512);
}

function hasEditor(element: Element): boolean {
    return [element, ...Array.from(element.querySelectorAll('*'))].some(candidate => (
        Array.from(candidate.attributes).some(attribute => /^data-[\w-]+-editor-region$/.test(attribute.name) && attribute.value === 'true')
    ));
}

function isNumericMetricRow(element: Element): boolean {
    if (!element.matches('[data-d-component="row"][data-d-direction="row"]') || element.children.length < 2) return false;
    return Array.from(element.children).every(box => {
        if (!box.matches('[data-d-component="box"][data-d-direction="col"]')) return false;
        const title = box.querySelector(':scope > [data-d-component="title"][data-d-tabular-nums="true"]');
        const caption = box.querySelector(':scope > [data-d-component="caption"]');
        return Boolean(caption?.textContent?.trim()) && /^[+\-−]?(?:\d+(?:[.,]\d+)?|\.\d+)%?$/.test(title?.textContent?.trim() ?? '');
    });
}

function classifyKind(element: Element): RichBlockKindV1 | null {
    if (element.closest(EXCLUDED_OWNER)) return null;
    if (element.matches(CHART_SELECTOR)) return 'html';
    if (isNumericMetricRow(element)) return 'html';
    if (element.matches('[data-d-component="box"][data-d-has-border]')
        && element.getAttribute('data-d-has-border') !== 'false'
        && element.querySelector('[data-d-component="row"], [data-d-component="grid"], [data-d-component="grid-item"]')) return 'html';
    if (element.matches('[data-d-component="box"]') && element.querySelector('[data-d-component="grid"]')
        && Array.from(element.querySelectorAll('h1,h2,h3')).some(heading => /^[\d.,+−%\s]+$/.test(heading.textContent?.trim() ?? ''))) return 'html';
    const tag = element.localName.toLowerCase();
    if (tag === 'svg') return element.querySelector('foreignObject') ? 'html' : 'svg';
    if (tag === 'img') return element.getAttribute('data-d-component') === 'svg' ? 'svg' : 'image';
    if (tag === 'canvas') return 'canvas';
    if (tag === 'iframe') return 'embed';
    const testId = element.getAttribute('data-testid') ?? '';
    if (testId.endsWith('-block-container') && !hasEditor(element)) return 'unknown';
    return null;
}

/** Selection only needs opaque boundaries, never SVG sources or asset capture. */
export function isChatGPTOpaqueRichBlock(element: Element): boolean {
    return classifyKind(element) !== null;
}

/** Scoped attribute invalidation shares the same exclusions as extraction. */
export function isChatGPTRichVisualMutationTarget(element: Element): boolean {
    if (element.closest(VISUAL_MUTATION_EXCLUDED_OWNER)) return false;
    // Chart drawings may be aria-hidden because the same block exposes a
    // separate accessible data list. They still contribute visible pixels.
    const chart = element.closest(CHART_SELECTOR);
    if (chart && classifyKind(chart) !== null) return true;
    const owner = element.closest(`svg, img, canvas, iframe, ${CHART_SELECTOR}, [data-d-component="box"][data-d-has-border]`);
    return owner !== null && classifyKind(owner) !== null;
}

function dimensions(element: Element): { width?: number; height?: number } {
    const result: { width?: number; height?: number } = {};
    for (const name of ['width', 'height'] as const) {
        const number = Number(element.getAttribute(name));
        if (Number.isFinite(number) && number > 0 && number <= 16_384) result[name] = number;
    }
    return result;
}

function decodeSvgImage(url: string): string | null {
    const match = /^data:image\/svg\+xml((?:;[^,]*)?),(.*)$/is.exec(url);
    if (!match || url.length > 786_432) return null;
    try {
        return /;base64/i.test(match[1])
            ? new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(match[2]), character => character.charCodeAt(0)))
            : decodeURIComponent(match[2]);
    } catch {
        return null;
    }
}

function sourceOf(element: Element, kind: RichBlockKindV1): RichBlockSourceV1 {
    if (kind === 'svg') {
        const input = element.localName.toLowerCase() === 'img'
            ? decodeSvgImage(element.getAttribute('src') ?? '')
            : element.outerHTML;
        if (!input) return { kind: 'unavailable', reason: 'not-rendered' };
        const safe = sanitizeLightweightSvg(input);
        if (safe.kind === 'ready') return { kind: 'svg', svg: safe.svg, ...(safe.width ? { width: safe.width } : {}), ...(safe.height ? { height: safe.height } : {}) };
        return safe.reason === 'unsupported'
            ? { kind: 'dom-capture', surface: 'html' }
            : { kind: 'unavailable', reason: 'unsafe-resource' };
    }
    if (kind === 'image') {
        const raw = element.getAttribute('src')?.trim() ?? '';
        if (!raw) return { kind: 'unavailable', reason: 'not-rendered' };
        let url = raw;
        try { url = new URL(raw, element.ownerDocument.baseURI).href; } catch { return { kind: 'unavailable', reason: 'unsafe-resource' }; }
        if (!/^(?:https?:|blob:|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(url)) {
            return { kind: 'unavailable', reason: 'unsafe-resource' };
        }
        return { kind: 'loaded-image', url, ...dimensions(element) };
    }
    if (kind === 'canvas') return { kind: 'dom-capture', surface: 'canvas' };
    if (kind === 'html') return { kind: 'dom-capture', surface: 'html' };
    if (kind === 'embed') return { kind: 'dom-capture', surface: 'iframe' };
    return { kind: 'unavailable', reason: 'unsupported' };
}

/** Captions are labels only: identity binds the whole visual structure and its local ordinal. */
export function collectChatGPTRichBlockSurfaces(root: HTMLElement): readonly ChatGPTRichBlockSurface[] {
    const selected: ChatGPTRichBlockSurface[] = [];
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
        if (selected.some(surface => surface.element.contains(element))) continue;
        const kind = classifyKind(element);
        if (!kind) continue;
        const label = labelOf(element, kind);
        const visualDigest = hash(element.outerHTML.replace(/\sdata-aimd-[\w-]+="[^"]*"/g, ''));
        const id = `rich-${selected.length + 1}-${visualDigest}`;
        const readable = textOf(element).trim();
        const fallbackMarkdown = `> [${label.replace(/[\r\n]/g, ' ')}]\n${readable ? `>\n> ${readable}` : ''}`.trim();
        const block = freezeRichBlocks([{ id, kind, label, visualDigest, fallbackMarkdown, source: sourceOf(element, kind) }])[0];
        selected.push(Object.freeze({ element, block }));
    }
    return Object.freeze(selected);
}

export function normalizeChatGPTRichBlocks(clone: HTMLElement): readonly RichBlockV1[] {
    const surfaces = collectChatGPTRichBlockSurfaces(clone);
    const admitted: RichBlockV1[] = [];
    for (const { element, block } of surfaces) {
        const replacement = clone.ownerDocument.createElement(element.parentElement?.localName === 'p' ? 'span' : 'p');
        if (!isRichBlocksV1([...admitted, block])) {
            replacement.textContent = '[Visual block omitted: capture limit]';
            if (element === clone) clone.replaceChildren(replacement);
            else element.replaceWith(replacement);
            continue;
        }
        admitted.push(block);
        const marker = clone.ownerDocument.createElement('img');
        marker.setAttribute('src', createRichContentUrl(block.id));
        marker.setAttribute('alt', block.label);
        replacement.append(marker);
        if (element === clone) clone.replaceChildren(replacement);
        else element.replaceWith(replacement);
    }
    return freezeRichBlocks(admitted);
}
