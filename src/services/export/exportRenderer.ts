import { browser } from '../../drivers/shared/browser';
import {
    ExportRenderHostClient,
    ExportRenderHostError,
    type RenderHostArtifact,
    type RenderHostJobResult,
} from './exportRenderHostClient';
import {
    EXPORT_RENDER_HOST_CONNECT_TYPE,
    EXPORT_RENDER_HOST_PROTOCOL_VERSION,
    type RenderHostJob,
} from './exportRenderHostProtocol';
import type { ImageExportProgressEvent } from './imageExportContracts';
import {
    __resetExportTaskSchedulerForTests,
    runExclusiveExportTask,
} from './exportTaskScheduler';

const RENDERER_HTML = 'export-renderer.html';
const DEFAULT_JOB_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 120_000;
const CACHE_MAX_ENTRIES = 32;
const CACHE_MAX_BYTES = 32 * 1024 * 1024;
const DOCUMENT_CACHE_MAX_BYTES = 8 * 1024 * 1024;

type CacheEntry = {
    value: RenderHostJobResult;
    bytes: number;
    expiresAt: number;
};

type InFlightEntry = {
    controller: AbortController;
    consumers: Set<symbol>;
    progressListeners: Map<symbol, (event: ImageExportProgressEvent) => void>;
    promise: Promise<RenderHostJobResult>;
    settled: boolean;
};

export type RenderExportJobOptions = {
    signal?: AbortSignal;
    timeoutMs?: number;
    onProgress?: (event: ImageExportProgressEvent) => void;
};

export type ExportRendererConnector = {
    connect: () => Promise<{ port: MessagePort; teardown?: () => void | Promise<void> }>;
    teardown: () => void;
};

export class IframeExportRendererConnector {
    private iframe: HTMLIFrameElement | null = null;
    private iframePromise: Promise<HTMLIFrameElement> | null = null;

    async connect() {
        const iframe = await this.ensureIframe();
        const targetWindow = iframe.contentWindow;
        if (!iframe.isConnected || !targetWindow) {
            this.teardown();
            throw new ExportRenderHostError('HOST_UNAVAILABLE', 'Export renderer was removed before connection.');
        }
        const channel = new MessageChannel();
        try {
            targetWindow.postMessage({
                v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
                type: EXPORT_RENDER_HOST_CONNECT_TYPE,
            }, this.rendererOrigin(), [channel.port2]);
        } catch (error) {
            channel.port1.close();
            channel.port2.close();
            this.teardown();
            throw new ExportRenderHostError(
                'HOST_UNAVAILABLE',
                error instanceof Error ? error.message : 'Export renderer connection failed.',
            );
        }
        return {
            port: channel.port1,
            teardown: () => this.teardown(),
        };
    }

    teardown(): void {
        this.iframe?.remove();
        this.iframe = null;
        this.iframePromise = null;
        cache.clear();
    }

    private ensureIframe(): Promise<HTMLIFrameElement> {
        if (this.iframe?.isConnected) return Promise.resolve(this.iframe);
        if (this.iframePromise) return this.iframePromise;
        const promise = new Promise<HTMLIFrameElement>((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.title = 'AI-MarkDone export renderer';
            iframe.setAttribute('aria-hidden', 'true');
            iframe.tabIndex = -1;
            iframe.style.position = 'fixed';
            iframe.style.left = '-10000px';
            iframe.style.top = '0';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.border = '0';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            iframe.addEventListener('load', () => resolve(iframe), { once: true });
            iframe.addEventListener('error', () => reject(new ExportRenderHostError(
                'HOST_UNAVAILABLE',
                'Export renderer failed to load.',
            )), { once: true });
            iframe.src = browser.runtime.getURL(RENDERER_HTML);
            (document.body || document.documentElement).appendChild(iframe);
            this.iframe = iframe;
        }).catch((error) => {
            this.teardown();
            throw error;
        });
        this.iframePromise = promise;
        return promise.finally(() => {
            // A resolved promise must not pin an iframe that the host page later removes.
            // The next job should observe isConnected and create a fresh renderer immediately.
            if (this.iframePromise === promise) this.iframePromise = null;
        });
    }

    private rendererOrigin(): string {
        return new URL(browser.runtime.getURL(RENDERER_HTML)).origin;
    }
}

const defaultConnector = new IframeExportRendererConnector();
let connector: ExportRendererConnector = defaultConnector;
let client: ExportRenderHostClient | null = null;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, InFlightEntry>();

function getClient(): ExportRenderHostClient {
    client ??= new ExportRenderHostClient({ connect: () => connector.connect() });
    return client;
}

function jobKey(job: RenderHostJob): string {
    return JSON.stringify(job);
}

function artifactBytes(artifacts: RenderHostArtifact[]): number {
    return artifacts.reduce(
        (total, artifact) => total + artifact.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
        0,
    );
}

function readCache(key: string): RenderHostJobResult | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
}

function writeCache(key: string, job: RenderHostJob, value: RenderHostJobResult): void {
    const bytes = artifactBytes(value.artifacts);
    if (bytes > CACHE_MAX_BYTES || (job.kind === 'message-png' && bytes > DOCUMENT_CACHE_MAX_BYTES)) return;
    cache.delete(key);
    cache.set(key, { value, bytes, expiresAt: Date.now() + CACHE_TTL_MS });
    let totalBytes = Array.from(cache.values()).reduce((sum, entry) => sum + entry.bytes, 0);
    while (cache.size > CACHE_MAX_ENTRIES || totalBytes > CACHE_MAX_BYTES) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) break;
        const removed = cache.get(oldestKey);
        cache.delete(oldestKey);
        totalBytes -= removed?.bytes ?? 0;
    }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new ExportRenderHostError(
            'HOST_UNAVAILABLE',
            'Export renderer timed out.',
        )), timeoutMs);
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

async function executeOnce(job: RenderHostJob, options: RenderExportJobOptions): Promise<RenderHostJobResult> {
    if (options.signal?.aborted) throw new DOMException('Image export cancelled.', 'AbortError');
    const handle = getClient().enqueue(job, { onProgress: options.onProgress });
    const cancel = () => handle.cancel();
    options.signal?.addEventListener('abort', cancel, { once: true });
    try {
        return await withTimeout(handle.result, options.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS);
    } finally {
        options.signal?.removeEventListener('abort', cancel);
    }
}

export async function renderExportHostJob(
    job: RenderHostJob,
    options: RenderExportJobOptions = {},
): Promise<RenderHostJobResult> {
    if (options.signal?.aborted) throw createAbortError();
    const key = jobKey(job);
    const cached = readCache(key);
    if (cached) return cached;

    let entry = inFlight.get(key);
    if (!entry) {
        const controller = new AbortController();
        entry = {
            controller,
            consumers: new Set(),
            progressListeners: new Map(),
            promise: Promise.resolve({ artifacts: [] }),
            settled: false,
        };
        const current = entry;
        current.promise = runExclusiveExportTask(async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const result = await executeOnce(job, {
                    signal: controller.signal,
                    timeoutMs: options.timeoutMs,
                    onProgress: (event) => {
                        for (const listener of current.progressListeners.values()) {
                            try {
                                listener(event);
                            } catch {
                                // Progress observers cannot fail or cancel the shared renderer job.
                            }
                        }
                    },
                });
                writeCache(key, job, result);
                return result;
            } catch (error) {
                lastError = error;
                if (error instanceof DOMException && error.name === 'AbortError') throw error;
                if (error instanceof Error && error.name === 'AbortError') throw error;
                if (error instanceof ExportRenderHostError
                    && error.code !== 'HOST_UNAVAILABLE'
                    && error.code !== 'PROTOCOL_ERROR') {
                    throw error;
                }
                client?.dispose();
                client = null;
            }
        }
        throw lastError;
        }, controller.signal).finally(() => {
            current.settled = true;
            if (inFlight.get(key) === current) inFlight.delete(key);
        });
        inFlight.set(key, current);
    }

    return subscribeToInFlight(entry, options);
}

function subscribeToInFlight(
    entry: InFlightEntry,
    options: RenderExportJobOptions,
): Promise<RenderHostJobResult> {
    if (options.signal?.aborted) return Promise.reject(createAbortError());
    const token = Symbol('export-render-consumer');
    entry.consumers.add(token);
    if (options.onProgress) entry.progressListeners.set(token, options.onProgress);

    return new Promise((resolve, reject) => {
        let finished = false;
        const cleanup = () => {
            options.signal?.removeEventListener('abort', abort);
            entry.consumers.delete(token);
            entry.progressListeners.delete(token);
            if (!entry.settled && entry.consumers.size === 0) entry.controller.abort();
        };
        const settle = (callback: () => void) => {
            if (finished) return;
            finished = true;
            cleanup();
            callback();
        };
        const abort = () => settle(() => reject(createAbortError()));
        options.signal?.addEventListener('abort', abort, { once: true });
        entry.promise.then(
            (result) => settle(() => resolve(result)),
            (error) => settle(() => reject(error)),
        );
    });
}

function createAbortError(): Error {
    const error = new Error('Image export cancelled.');
    error.name = 'AbortError';
    return error;
}

export function __resetExportRendererForTests(): void {
    client?.dispose();
    client = null;
    connector.teardown();
    connector = defaultConnector;
    cache.clear();
    for (const entry of inFlight.values()) entry.controller.abort();
    inFlight.clear();
    __resetExportTaskSchedulerForTests();
}

export function __setExportRendererConnectorForTests(next: ExportRendererConnector): void {
    __resetExportRendererForTests();
    connector = next;
}
