export type KatexEmbeddedCssResult = {
    mode: 'none' | 'data-url';
    css: string;
};

export type KatexRuntimeCssResult = {
    mode: 'none' | 'runtime-url';
    css: string;
};

const KATEX_CSS_PATH = 'vendor/katex/katex.min.css';
const FONT_URL_RE = /url\((['"]?)(fonts\/[^)'"]+\.woff2)\1\)/gi;
const ANY_FONT_URL_RE = /url\((['"]?)(fonts\/[^)'"]+)\1\)/gi;
const FONT_FACE_RE = /@font-face\{[^}]+\}/g;

let embeddedCssPromise: Promise<string> | null = null;
let runtimeCssPromise: Promise<string> | null = null;
let runtimeFontFaceCssPromise: Promise<string> | null = null;

export function hasKatexMarkup(html: string): boolean {
    return /\bclass\s*=\s*["'][^"']*\bkatex\b/i.test(html || '');
}

function getRuntimeUrl(path: string): string {
    try {
        const runtime = (globalThis as any).browser?.runtime || (globalThis as any).chrome?.runtime;
        const url = runtime?.getURL?.(path);
        if (typeof url === 'string' && url) return url;
    } catch {
        // Relative extension-origin paths remain valid inside the renderer and content bundles.
    }
    return path;
}

export function getKatexStylesheetHref(): string {
    return getRuntimeUrl(KATEX_CSS_PATH);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response?.ok) throw new Error(`KaTeX CSS request failed: ${response?.status || 'unknown'}`);
    return response.text();
}

async function fetchFontDataUrl(path: string): Promise<string> {
    const response = await fetch(getRuntimeUrl(`vendor/katex/${path}`));
    if (!response?.ok) throw new Error(`KaTeX font request failed: ${path}`);
    const base64 = arrayBufferToBase64(await response.arrayBuffer());
    return `url("data:font/woff2;base64,${base64}")`;
}

async function buildEmbeddedCss(): Promise<string> {
    const css = await fetchText(getKatexStylesheetHref());
    const paths = Array.from(new Set(Array.from(css.matchAll(FONT_URL_RE)).map((match) => match[2])));
    const replacements = new Map<string, string>();
    await Promise.all(paths.map(async (path) => {
        replacements.set(path, await fetchFontDataUrl(path));
    }));
    return css.replace(FONT_URL_RE, (_match, _quote, path) => replacements.get(path) || `url("${path}")`);
}

async function buildRuntimeCss(): Promise<string> {
    const css = await fetchText(getKatexStylesheetHref());
    return css.replace(ANY_FONT_URL_RE, (_match, _quote, path) => `url("${getRuntimeUrl(`vendor/katex/${path}`)}")`);
}

async function buildRuntimeFontFaceCss(): Promise<string> {
    const css = await getKatexCssWithRuntimeFontUrls('<span class="katex"></span>').then((result) => result.css);
    return Array.from(css.matchAll(FONT_FACE_RE)).map((match) => match[0]).join('');
}

export async function getKatexCssWithEmbeddedFonts(html: string): Promise<KatexEmbeddedCssResult> {
    if (!hasKatexMarkup(html)) return { mode: 'none', css: '' };
    if (!embeddedCssPromise) {
        embeddedCssPromise = buildEmbeddedCss().catch((error) => {
            embeddedCssPromise = null;
            throw error;
        });
    }
    return { mode: 'data-url', css: await embeddedCssPromise };
}

export async function getKatexCssWithRuntimeFontUrls(html: string): Promise<KatexRuntimeCssResult> {
    if (!hasKatexMarkup(html)) return { mode: 'none', css: '' };
    if (!runtimeCssPromise) {
        runtimeCssPromise = buildRuntimeCss().catch((error) => {
            runtimeCssPromise = null;
            throw error;
        });
    }
    return { mode: 'runtime-url', css: await runtimeCssPromise };
}

export async function getKatexRuntimeFontFaceCss(): Promise<string> {
    if (!runtimeFontFaceCssPromise) {
        runtimeFontFaceCssPromise = buildRuntimeFontFaceCss().catch((error) => {
            runtimeFontFaceCssPromise = null;
            throw error;
        });
    }
    return runtimeFontFaceCssPromise;
}
