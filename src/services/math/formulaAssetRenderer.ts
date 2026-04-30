import type { FormulaSvgAsset } from '../../core/math/formulaAssetTypes';
import {
    FORMULA_RENDERER_REQUEST_TYPE,
    FORMULA_RENDERER_RESPONSE_TYPE,
    type FormulaRendererRequest,
    type FormulaRendererResponse,
} from '../../core/math/formulaRendererProtocol';
import { browser } from '../../drivers/shared/browser';

export type { FormulaSvgAsset } from '../../core/math/formulaAssetTypes';

export const DEFAULT_FORMULA_FONT_SIZE_PX = 36;
const DEFAULT_RENDER_TIMEOUT_MS = 8000;
const MAX_CACHE_ENTRIES = 32;
const RENDERER_HTML = 'formula-renderer.html';

export type FormulaRenderOptions = {
    source: string;
    displayMode: boolean;
    fontSizePx?: number;
    timeoutMs?: number;
};

type FormulaRendererTransportRequest = {
    source: string;
    displayMode: boolean;
    fontSizePx: number;
    timeoutMs: number;
};

type FormulaRendererTransport = (request: FormulaRendererTransportRequest) => Promise<FormulaSvgAsset>;

const cache = new Map<string, FormulaSvgAsset>();
const inFlight = new Map<string, Promise<FormulaSvgAsset>>();
let testTransport: FormulaRendererTransport | null = null;
let iframeTransport: IframeFormulaRendererTransport | null = null;

function cacheKey(request: Omit<FormulaRendererTransportRequest, 'timeoutMs'>): string {
    return JSON.stringify([request.source, request.displayMode, request.fontSizePx]);
}

function writeCache(key: string, asset: FormulaSvgAsset): void {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, asset);
    while (cache.size > MAX_CACHE_ENTRIES) {
        const firstKey = cache.keys().next().value;
        if (!firstKey) break;
        cache.delete(firstKey);
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Formula renderer timed out.')), timeoutMs);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}

function getFormulaRendererTransport(): FormulaRendererTransport {
    if (testTransport) return testTransport;
    iframeTransport ??= new IframeFormulaRendererTransport();
    return (request) => iframeTransport!.render(request);
}

export async function renderFormulaSvgAsset(options: FormulaRenderOptions): Promise<FormulaSvgAsset> {
    const source = options.source.trim();
    if (!source) throw new Error('Formula source is empty.');
    const fontSizePx = Number.isFinite(options.fontSizePx) && (options.fontSizePx ?? 0) > 0
        ? Math.round(options.fontSizePx!)
        : DEFAULT_FORMULA_FONT_SIZE_PX;
    const timeoutMs = Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
        ? Math.round(options.timeoutMs!)
        : DEFAULT_RENDER_TIMEOUT_MS;
    const request = {
        source,
        displayMode: options.displayMode,
        fontSizePx,
    };
    const key = cacheKey(request);
    const cached = cache.get(key);
    if (cached) return cached;

    const existing = inFlight.get(key);
    if (existing) return existing;

    const transport = getFormulaRendererTransport();
    const pending = withTimeout(transport({ ...request, timeoutMs }), timeoutMs)
        .then((asset) => {
            writeCache(key, asset);
            return asset;
        })
        .finally(() => {
            inFlight.delete(key);
        });
    inFlight.set(key, pending);
    return pending;
}

class IframeFormulaRendererTransport {
    private iframe: HTMLIFrameElement | null = null;
    private iframeReady: Promise<HTMLIFrameElement> | null = null;
    private readonly pending = new Map<string, {
        resolve: (asset: FormulaSvgAsset) => void;
        reject: (error: Error) => void;
        timer: number;
    }>();
    private nextId = 0;

    render(request: FormulaRendererTransportRequest): Promise<FormulaSvgAsset> {
        const id = `formula-${Date.now()}-${++this.nextId}`;
        const message: FormulaRendererRequest = {
            type: FORMULA_RENDERER_REQUEST_TYPE,
            id,
            source: request.source,
            displayMode: request.displayMode,
            fontSizePx: request.fontSizePx,
        };
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                const pending = this.pending.get(id);
                if (!pending) return;
                this.pending.delete(id);
                pending.reject(new Error('Formula renderer timed out.'));
            }, request.timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.ensureIframe()
                .then((iframe) => {
                    iframe.contentWindow?.postMessage(message, this.rendererOrigin());
                })
                .catch((error) => {
                    window.clearTimeout(timer);
                    this.pending.delete(id);
                    reject(error instanceof Error ? error : new Error(String(error)));
                });
        });
    }

    private ensureIframe(): Promise<HTMLIFrameElement> {
        if (this.iframe?.isConnected) return Promise.resolve(this.iframe);
        if (this.iframeReady) return this.iframeReady;

        this.iframeReady = new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.title = 'AI-MarkDone formula renderer';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.tabIndex = -1;
            iframe.style.position = 'fixed';
            iframe.style.left = '-10000px';
            iframe.style.top = '0';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.border = '0';
            iframe.style.opacity = '0';
            iframe.addEventListener('load', () => resolve(iframe), { once: true });
            iframe.addEventListener('error', () => reject(new Error('Formula renderer failed to load.')), { once: true });
            iframe.src = browser.runtime.getURL(RENDERER_HTML);
            window.addEventListener('message', this.handleMessage);
            (document.body || document.documentElement).appendChild(iframe);
            this.iframe = iframe;
        });
        return this.iframeReady;
    }

    private rendererOrigin(): string {
        return new URL(browser.runtime.getURL(RENDERER_HTML)).origin;
    }

    private readonly handleMessage = (event: MessageEvent) => {
        if (event.source !== this.iframe?.contentWindow) return;
        if (event.origin !== this.rendererOrigin()) return;
        const response = event.data as Partial<FormulaRendererResponse>;
        if (response?.type !== FORMULA_RENDERER_RESPONSE_TYPE || typeof response.id !== 'string') return;
        const pending = this.pending.get(response.id);
        if (!pending) return;
        this.pending.delete(response.id);
        window.clearTimeout(pending.timer);
        if (response.ok && response.asset) {
            pending.resolve(response.asset);
        } else {
            const message = 'message' in response && typeof response.message === 'string'
                ? response.message
                : 'Formula render failed.';
            pending.reject(new Error(message));
        }
    };
}

export function __setFormulaRendererTransportForTests(transport: FormulaRendererTransport): void {
    testTransport = transport;
}

export function __resetFormulaAssetRendererForTests(): void {
    testTransport = null;
    iframeTransport = null;
    cache.clear();
    inFlight.clear();
}
