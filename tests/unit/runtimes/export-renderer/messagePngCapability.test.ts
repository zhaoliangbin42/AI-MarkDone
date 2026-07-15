import { afterEach, describe, expect, it, vi } from 'vitest';

const renderedCanvasSizes: Array<{ width: number; height: number }> = [];
const renderedCanvasText: string[] = [];
const renderedViewportOffsets: Array<{ left: string; top: string }> = [];
const renderedCanvases: Array<{ width: number; height: number }> = [];
const renderedCanvasUsedFilter: boolean[] = [];
const renderedSourceOffsets: string[] = [];
const renderedCardHeights: string[] = [];
const renderedMathMlCounts: number[] = [];
const renderedKatexHtmlCounts: number[] = [];
const renderedStylePropertyLists: string[][] = [];

function filteredText(node: Node, filter?: (node: Node) => boolean): string {
    if (filter && !filter(node)) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    return Array.from(node.childNodes).map((child) => filteredText(child, filter)).join('');
}

vi.mock('html-to-image', () => ({
    toCanvas: vi.fn(async (_node: HTMLElement, options: any) => {
        const width = Math.trunc(options.canvasWidth * options.pixelRatio);
        const height = Math.trunc(options.canvasHeight * options.pixelRatio);
        renderedCanvasSizes.push({ width, height });
        renderedCanvasText.push(filteredText(_node, options.filter));
        renderedCanvasUsedFilter.push(typeof options.filter === 'function');
        renderedSourceOffsets.push(
            _node.querySelector<HTMLElement>('#aimd-export-renderer-message-root')?.style.top ?? '',
        );
        renderedCardHeights.push(
            _node.querySelector<HTMLElement>('.aimd-png-export-card')?.style.height ?? '',
        );
        renderedMathMlCounts.push(_node.querySelectorAll('.katex-mathml').length);
        renderedKatexHtmlCounts.push(_node.querySelectorAll('.katex-html').length);
        renderedStylePropertyLists.push([...(options.includeStyleProperties ?? [])]);
        renderedViewportOffsets.push({ left: _node.style.left, top: _node.style.top });
        const canvas = {
            width,
            height,
            getContext: () => ({
                getImageData: () => ({ data: new Uint8ClampedArray(4) }),
            }),
        };
        renderedCanvases.push(canvas);
        return canvas;
    }),
}));

vi.mock('../../../../src/core/export/katexAssets', () => ({
    getKatexCssWithEmbeddedFonts: vi.fn(async () => ({ mode: 'none', css: '' })),
}));

import type {
    PngEncoderWorkerCommand,
    PngEncoderWorkerEvent,
} from '../../../../src/core/export/pngEncoderWorkerProtocol';
import { renderMessagePngCapability } from '../../../../src/runtimes/export-renderer/messagePngCapability';

class FakePngWorker {
    private readonly messageListeners = new Set<(event: MessageEvent<PngEncoderWorkerEvent>) => void>();

    addEventListener(type: string, listener: EventListener): void {
        if (type === 'message') this.messageListeners.add(listener as (event: MessageEvent<PngEncoderWorkerEvent>) => void);
    }

    removeEventListener(type: string, listener: EventListener): void {
        if (type === 'message') this.messageListeners.delete(listener as (event: MessageEvent<PngEncoderWorkerEvent>) => void);
    }

    postMessage(command: PngEncoderWorkerCommand): void {
        queueMicrotask(() => {
            if (command.type === 'start') {
                this.emit({ type: 'chunk', bytes: new ArrayBuffer(8) });
                this.emit({ type: 'started' });
            } else if (command.type === 'write-band') {
                this.emit({ type: 'band-written', y: command.y, height: command.height });
            } else if (command.type === 'finish') {
                this.emit({ type: 'chunk', bytes: new ArrayBuffer(8) });
                this.emit({ type: 'complete' });
            } else {
                this.emit({ type: 'cancelled' });
            }
        });
    }

    terminate(): void {}

    private emit(data: PngEncoderWorkerEvent): void {
        const event = { data } as MessageEvent<PngEncoderWorkerEvent>;
        for (const listener of this.messageListeners) listener(event);
    }
}

class AbortDuringBandWorker extends FakePngWorker {
    constructor(private readonly abort: () => void) {
        super();
    }

    override postMessage(command: PngEncoderWorkerCommand): void {
        if (command.type === 'write-band') {
            this.abort();
            return;
        }
        super.postMessage(command);
    }
}

class DeferredBandWorker extends FakePngWorker {
    private pendingBand: Extract<PngEncoderWorkerCommand, { type: 'write-band' }> | null = null;

    override postMessage(command: PngEncoderWorkerCommand): void {
        if (command.type === 'write-band') {
            this.pendingBand = command;
            return;
        }
        super.postMessage(command);
    }

    hasPendingBand(): boolean {
        return this.pendingBand !== null;
    }

    releaseBand(): void {
        const command = this.pendingBand;
        this.pendingBand = null;
        if (command) super.postMessage(command);
    }
}

describe('renderMessagePngCapability', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        renderedCanvasSizes.length = 0;
        renderedCanvasText.length = 0;
        renderedViewportOffsets.length = 0;
        renderedCanvases.length = 0;
        renderedCanvasUsedFilter.length = 0;
        renderedSourceOffsets.length = 0;
        renderedCardHeights.length = 0;
        renderedMathMlCounts.length = 0;
        renderedKatexHtmlCounts.length = 0;
        renderedStylePropertyLists.length = 0;
    });

    it('streams one tall artifact through bounded band canvases without a final tall canvas', async () => {
        const originalCloneNode = HTMLElement.prototype.cloneNode;
        const deepSourceClone = vi.fn();
        vi.spyOn(HTMLElement.prototype, 'cloneNode').mockImplementation(function (deep?: boolean) {
            if (deep && this.id === 'aimd-export-renderer-message-root') deepSourceClone();
            return originalCloneNode.call(this, deep) as Node;
        });
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 12_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 360,
            bottom: 12_000,
            left: 0,
            width: 360,
            height: 12_000,
            toJSON: () => ({}),
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });

        const artifactStarts: any[] = [];
        const chunks: ArrayBuffer[] = [];
        let completed = 0;
        await renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Tall',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{
                    sourceIndex: 0,
                    heading: 'Message 1',
                    userText: 'Question',
                    assistantMarkdown: 'Answer',
                }],
            },
            options: { widthCssPx: 360, requestedPixelRatio: 1 },
        }, {
            onProgress: () => undefined,
            onArtifactStart: (metadata) => artifactStarts.push(metadata),
            onArtifactChunk: (_sequence, bytes) => chunks.push(bytes),
            onArtifactComplete: () => { completed += 1; },
        }, {
            createWorker: () => new FakePngWorker() as unknown as Worker,
        });

        expect(artifactStarts).toEqual([expect.objectContaining({
            widthPx: 360,
            heightPx: 12_000,
            effectivePixelRatio: 1,
            partNumber: 1,
            partCount: 1,
        })]);
        expect(completed).toBe(1);
        expect(chunks).toHaveLength(2);
        expect(renderedCanvasSizes.length).toBeGreaterThan(1);
        expect(Math.max(...renderedCanvasSizes.map((size) => size.width * size.height))).toBeLessThanOrEqual(8_000_000);
        expect(renderedCanvasSizes.some((size) => size.height === 12_000)).toBe(false);
        expect(renderedViewportOffsets).toEqual(
            renderedViewportOffsets.map(() => ({ left: '0px', top: '0px' })),
        );
        expect(deepSourceClone).not.toHaveBeenCalled();
    });

    it('preempts the active worker band when the export is cancelled', async () => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 12_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 360,
            bottom: 12_000,
            left: 0,
            width: 360,
            height: 12_000,
            toJSON: () => ({}),
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        const abort = new AbortController();
        const complete = vi.fn();

        await expect(renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Cancelled',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{ sourceIndex: 0, heading: 'Message 1', userText: 'Question', assistantMarkdown: 'Answer' }],
            },
            options: { widthCssPx: 360, requestedPixelRatio: 1 },
        }, {
            onProgress: () => undefined,
            onArtifactStart: () => undefined,
            onArtifactChunk: () => undefined,
            onArtifactComplete: complete,
        }, {
            signal: abort.signal,
            createWorker: () => new AbortDuringBandWorker(() => abort.abort()) as unknown as Worker,
        })).rejects.toMatchObject({ name: 'AbortError' });

        expect(complete).not.toHaveBeenCalled();
        expect(renderedCanvasSizes).toHaveLength(1);
    });

    it('releases a transferred band canvas before waiting for worker encoding', async () => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 1_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 360,
            bottom: 1_000,
            left: 0,
            width: 360,
            height: 1_000,
            toJSON: () => ({}),
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        const worker = new DeferredBandWorker();
        const render = renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Release canvas',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{ sourceIndex: 0, heading: 'Message 1', userText: 'Question', assistantMarkdown: 'Answer' }],
            },
            options: { widthCssPx: 360, requestedPixelRatio: 1 },
        }, {
            onProgress: () => undefined,
            onArtifactStart: () => undefined,
            onArtifactChunk: () => undefined,
            onArtifactComplete: () => undefined,
        }, {
            createWorker: () => worker as unknown as Worker,
        });

        await vi.waitFor(() => expect(worker.hasPendingBand()).toBe(true));
        expect(renderedCanvases[0]).toMatchObject({ width: 1, height: 1 });
        worker.releaseBand();
        await render;
        expect(renderedCanvasUsedFilter).toEqual([false]);
        expect(renderedStylePropertyLists[0]).toEqual(expect.arrayContaining([
            'display',
            'font-size',
            'line-height',
            'table-layout',
            'transform',
            'grid-template-columns',
        ]));
        expect(renderedStylePropertyLists[0]).toHaveLength(126);
        expect(new Set(renderedStylePropertyLists[0]).size).toBe(126);
    });

    it('removes non-visual KaTeX MathML from PNG bands while preserving visual KaTeX HTML', async () => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 1_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 360,
            bottom: 1_000,
            left: 0,
            width: 360,
            height: 1_000,
            toJSON: () => ({}),
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });

        await renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Visual formula only',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{
                    sourceIndex: 0,
                    heading: 'Message 1',
                    userText: 'Question',
                    assistantMarkdown: '$x^2 + y^2 = z^2$',
                }],
            },
            options: { widthCssPx: 360, requestedPixelRatio: 1 },
        }, {
            onProgress: () => undefined,
            onArtifactStart: () => undefined,
            onArtifactChunk: () => undefined,
            onArtifactComplete: () => undefined,
        }, {
            createWorker: () => new FakePngWorker() as unknown as Worker,
        });

        expect(renderedMathMlCounts).toEqual([0]);
        expect(renderedKatexHtmlCounts[0]).toBeGreaterThan(0);
    });

    it('removes off-band Markdown block content before html-to-image traverses the band DOM', async () => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 18_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            const text = this.textContent || '';
            const originalTop = text === 'first-band-block'
                ? 0
                : text === 'second-band-block'
                    ? 6_000
                    : text === 'third-band-block'
                        ? 12_000
                        : 0;
            const originalBottom = text === 'first-band-block'
                ? 6_000
                : text === 'second-band-block'
                    ? 12_000
                    : text === 'third-band-block'
                        ? 18_000
                        : 18_000;
            const isProjected = this.id !== 'aimd-export-renderer-message-root'
                && this.style.position === 'absolute';
            const parentRect = isProjected
                ? this.parentElement?.getBoundingClientRect()
                : null;
            const top = parentRect
                ? parentRect.top + (Number.parseFloat(this.style.top) || 0)
                : originalTop;
            const left = parentRect
                ? parentRect.left + (Number.parseFloat(this.style.left) || 0)
                : 0;
            const width = Number.parseFloat(this.style.width) || 360;
            const height = Number.parseFloat(this.style.height) || originalBottom - originalTop;
            return {
                x: left,
                y: top,
                top,
                right: left + width,
                bottom: top + height,
                left,
                width,
                height,
                toJSON: () => ({}),
            };
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });

        await renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Three bands',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{
                    sourceIndex: 0,
                    heading: 'Message 1',
                    userText: 'Question',
                    assistantMarkdown: 'first-band-block\n\nsecond-band-block\n\nthird-band-block',
                }],
            },
            options: { widthCssPx: 360, requestedPixelRatio: 1 },
        }, {
            onProgress: () => undefined,
            onArtifactStart: () => undefined,
            onArtifactChunk: () => undefined,
            onArtifactComplete: () => undefined,
        }, {
            createWorker: () => new FakePngWorker() as unknown as Worker,
        });

        expect(renderedCanvasText.length).toBeGreaterThanOrEqual(3);
        expect(renderedCanvasUsedFilter.every(Boolean)).toBe(true);
        expect(renderedSourceOffsets.every((offset) => offset === '0px')).toBe(true);
        expect(renderedCardHeights.every((height, index) => (
            Number.parseFloat(height) <= renderedCanvasSizes[index]!.height
        ))).toBe(true);
        expect(renderedCanvasText.some((text) => text.includes('first-band-block'))).toBe(true);
        expect(renderedCanvasText.some((text) => text.includes('second-band-block'))).toBe(true);
        expect(renderedCanvasText.some((text) => text.includes('third-band-block'))).toBe(true);
        for (const text of renderedCanvasText) {
            const visibleBlocks = [
                'first-band-block',
                'second-band-block',
                'third-band-block',
            ].filter((block) => text.includes(block));
            // A one-device-pixel seam guard may retain the immediately adjacent block,
            // but the rasterizer must never receive the whole document skeleton.
            expect(visibleBlocks.length).toBeGreaterThan(0);
            expect(visibleBlocks.length).toBeLessThanOrEqual(2);
        }
    });

    it('reports one monotonic band progress sequence across hard-limit PNG parts', async () => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 130_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 360,
            bottom: 130_000,
            left: 0,
            width: 360,
            height: 130_000,
            toJSON: () => ({}),
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        const progress: Array<{ phase: string; completed?: number; total?: number }> = [];

        await renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Multipart',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{ sourceIndex: 0, heading: 'Message 1', userText: 'Question', assistantMarkdown: 'Answer' }],
            },
            options: { widthCssPx: 360, requestedPixelRatio: 1 },
        }, {
            onProgress: (event) => progress.push(event),
            onArtifactStart: () => undefined,
            onArtifactChunk: () => undefined,
            onArtifactComplete: () => undefined,
        }, {
            createWorker: () => new FakePngWorker() as unknown as Worker,
        });

        const rasterizing = progress.filter((event) => event.phase === 'rasterizing');
        expect(rasterizing.length).toBeGreaterThan(10);
        expect(rasterizing.map((event) => event.completed)).toEqual(
            Array.from({ length: rasterizing.length }, (_value, index) => index),
        );
        expect(new Set(rasterizing.map((event) => event.total))).toEqual(new Set([rasterizing.length]));
    });

    it('keeps an exact ceil-rounded device width for odd CSS widths at fractional ratios', async () => {
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function () {
            return this.id === 'aimd-export-renderer-message-root' ? 1_000 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            right: 361,
            bottom: 1_000,
            left: 0,
            width: 361,
            height: 1_000,
            toJSON: () => ({}),
        });
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        const starts: any[] = [];

        await renderMessagePngCapability({
            kind: 'message-png',
            document: {
                schemaVersion: 1,
                profile: 'message-card-v1',
                title: 'Fractional width',
                labels: { user: 'You', assistant: 'Assistant' },
                sections: [{ sourceIndex: 0, heading: 'Message 1', userText: 'Question', assistantMarkdown: 'Answer' }],
            },
            options: { widthCssPx: 361, requestedPixelRatio: 1.5 },
        }, {
            onProgress: () => undefined,
            onArtifactStart: (metadata) => starts.push(metadata),
            onArtifactChunk: () => undefined,
            onArtifactComplete: () => undefined,
        }, {
            createWorker: () => new FakePngWorker() as unknown as Worker,
        });

        expect(starts[0].widthPx).toBe(542);
        expect(renderedCanvasSizes[0].width).toBe(542);
    });
});
