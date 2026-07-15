import { createServer, type ServerResponse } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
    chromium,
    firefox,
    type BrowserType,
    type Page,
} from '@playwright/test';
import type { ExportDocumentV1 } from '../src/services/export/imageExportContracts';

type BrowserName = 'chromium' | 'firefox';

type Corpus = {
    schemaVersion: 1;
    short: ExportDocumentV1;
    long: {
        title: string;
        repeat: number;
        assistantBlock: string;
    };
};

type BrowserArtifactMetadata = {
    mimeType: 'image/png';
    widthPx: number;
    heightPx: number;
    effectivePixelRatio: number;
    partNumber: number;
    partCount: number;
};

type BrowserArtifactResult = {
    metadata: BrowserArtifactMetadata;
    decodedWidth: number;
    decodedHeight: number;
    nonWhitePixelCount: number;
    byteLength: number;
    pngChunkCount: number;
    pngIdatChunkCount: number;
    maxValidationCanvasWidth: number;
    maxValidationCanvasHeight: number;
    maxValidationCanvasPixels: number;
    base64?: string;
};

type BrowserJobResult = {
    durationMs: number;
    validationDurationMs: number;
    progressPhases: string[];
    bandRasterWallMs: number[];
    artifacts: BrowserArtifactResult[];
};

type PageHarnessResult = {
    shortCold: BrowserJobResult;
    shortWarm: BrowserJobResult;
    long: BrowserJobResult;
    formulaPng: BrowserJobResult;
};

type VisualComparison = {
    width: number;
    height: number;
    changedPixels: number;
    totalPixels: number;
    changedPixelRatio: number;
};

type HarnessServer = {
    origin: string;
    close: () => Promise<void>;
};

type BrowserHarnessResult = {
    browser: BrowserName;
    localRequestCount: number;
    remoteRequestCount: number;
    short: {
        coldMs: number;
        warmMs: number;
        coldValidationMs: number;
        warmValidationMs: number;
        foregroundPixelCount: number;
        metadata: BrowserArtifactMetadata[];
        golden: VisualComparison & { updated: boolean };
    };
    long: {
        durationMs: number;
        validationDurationMs: number;
        foregroundPixelCount: number;
        maxBandRasterWallMs: number;
        p95BandRasterWallMs: number;
        maxValidationCanvasHeight: number;
        maxValidationCanvasPixels: number;
        pngIdatChunkCount: number;
        metadata: BrowserArtifactMetadata[];
    };
    formula: {
        pngDurationMs: number;
        pngValidationDurationMs: number;
        foregroundPixelCount: number;
        metadata: BrowserArtifactMetadata[];
    };
};

export type ImageExportBrowserHarnessReport = {
    schemaVersion: 1;
    updateGoldens: boolean;
    longRepeat: number;
    visualLimits: typeof VISUAL_GOLDEN_LIMITS;
    browsers: BrowserHarnessResult[];
};

const VISUAL_GOLDEN_LIMITS = {
    channelTolerance: 8,
    maxChangedPixelRatio: 0.005,
} as const;

const CANONICAL_60K_REPEAT = 171;
const MIN_60K_ARTIFACT_HEIGHT_PX = 60_000;
const MAX_60K_ARTIFACT_HEIGHT_PX = 65_535;

const BROWSER_CONFIGS: Array<{
    name: BrowserName;
    distDir: string;
    launcher: BrowserType;
}> = [
    { name: 'chromium', distDir: 'dist-chrome', launcher: chromium },
    { name: 'firefox', distDir: 'dist-firefox', launcher: firefox },
];

const MIME_TYPES: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

function invariant(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(`Image export browser harness failed: ${message}`);
}

function sendText(response: ServerResponse, status: number, contentType: string, body: string): void {
    response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType,
    });
    response.end(body);
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function assertBuiltRenderer(distDir: string): Promise<void> {
    for (const relativePath of ['export-renderer.html', 'export-renderer.js', 'png-encoder-worker.js']) {
        const path = resolve(distDir, relativePath);
        invariant(
            await pathExists(path),
            `${path} is missing; build the target before running this harness`,
        );
    }
}

function harnessHtml(target: BrowserName): string {
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>AI-MarkDone image export harness</title></head>
<body>
  <iframe
    id="export-renderer"
    title="Export renderer"
    src="/${target}/export-renderer.html"
    width="1280"
    height="720"
    style="position:fixed;left:-10000px;top:0;border:0;opacity:0;pointer-events:none"
  ></iframe>
</body>
</html>`;
}

async function createHarnessServer(): Promise<HarnessServer> {
    const roots: Record<BrowserName, string> = {
        chromium: resolve('dist-chrome'),
        firefox: resolve('dist-firefox'),
    };
    const server = createServer((request, response) => {
        void (async () => {
            const url = new URL(request.url ?? '/', 'http://127.0.0.1');
            if (url.pathname === '/harness.html') {
                const target = url.searchParams.get('target');
                if (target !== 'chromium' && target !== 'firefox') {
                    sendText(response, 400, 'text/plain; charset=utf-8', 'Unknown browser target');
                    return;
                }
                sendText(response, 200, 'text/html; charset=utf-8', harnessHtml(target));
                return;
            }

            const match = /^\/(chromium|firefox)\/(.*)$/.exec(url.pathname);
            if (!match) {
                sendText(response, 404, 'text/plain; charset=utf-8', 'Not found');
                return;
            }
            const target = match[1] as BrowserName;
            const root = roots[target];
            const path = resolve(root, decodeURIComponent(match[2] || ''));
            if (path !== root && !path.startsWith(`${root}${sep}`)) {
                sendText(response, 403, 'text/plain; charset=utf-8', 'Forbidden');
                return;
            }
            try {
                const body = await readFile(path);
                response.writeHead(200, {
                    'Cache-Control': 'no-store',
                    'Content-Type': MIME_TYPES[extname(path)] ?? 'application/octet-stream',
                });
                response.end(body);
            } catch {
                sendText(response, 404, 'text/plain; charset=utf-8', 'Not found');
            }
        })().catch((error) => {
            sendText(response, 500, 'text/plain; charset=utf-8', String(error));
        });
    });

    await new Promise<void>((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(0, '127.0.0.1', () => resolveListen());
    });
    const address = server.address();
    invariant(address && typeof address === 'object', 'local HTTP server did not expose a port');
    return {
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => error ? rejectClose(error) : resolveClose());
        }),
    };
}

async function loadCorpus(): Promise<{
    short: ExportDocumentV1;
    long: ExportDocumentV1;
    longRepeat: number;
}> {
    const path = resolve('tests/fixtures/image-export/message-export-corpus.json');
    const corpus = JSON.parse(await readFile(path, 'utf8')) as Corpus;
    invariant(corpus.schemaVersion === 1, 'fixture schema version is unsupported');
    invariant(corpus.short.schemaVersion === 1, 'short fixture is not ExportDocumentV1');
    invariant(Number.isInteger(corpus.long.repeat) && corpus.long.repeat > 1, 'long fixture repeat is invalid');

    const repeatArgument = process.argv.find((argument) => argument.startsWith('--long-repeat='));
    const requestedRepeat = repeatArgument ? Number(repeatArgument.slice('--long-repeat='.length)) : corpus.long.repeat;
    invariant(Number.isInteger(requestedRepeat) && requestedRepeat > 1, '--long-repeat must be an integer greater than one');
    const assistantMarkdown = Array.from({ length: requestedRepeat }, (_value, index) => (
        corpus.long.assistantBlock.replaceAll('{{index}}', String(index + 1))
    )).join('\n\n');
    return {
        longRepeat: requestedRepeat,
        short: corpus.short,
        long: {
            schemaVersion: 1,
            profile: 'message-card-v1',
            title: corpus.long.title,
            labels: { ...corpus.short.labels },
            sections: [{
                sourceIndex: 0,
                heading: 'Message 1',
                userText: 'Render the deterministic long fixture.',
                assistantMarkdown,
            }],
        },
    };
}

async function executeRendererJobs(
    page: Page,
    documents: { short: ExportDocumentV1; long: ExportDocumentV1 },
): Promise<PageHarnessResult> {
    // tsx preserves nested function names with this helper; Playwright serializes the callback without its module prelude.
    await page.evaluate('globalThis.__name = (target) => target');
    return page.evaluate(async ({ shortDocument, longDocument }) => {
        type Metadata = {
            mimeType: 'image/png';
            widthPx: number;
            heightPx: number;
            effectivePixelRatio: number;
            partNumber: number;
            partCount: number;
        };
        type Artifact = {
            metadata: Metadata;
            decodedWidth: number;
            decodedHeight: number;
            nonWhitePixelCount: number;
            byteLength: number;
            pngChunkCount: number;
            pngIdatChunkCount: number;
            maxValidationCanvasWidth: number;
            maxValidationCanvasHeight: number;
            maxValidationCanvasPixels: number;
            base64?: string;
        };
        type JobResult = {
            durationMs: number;
            validationDurationMs: number;
            progressPhases: string[];
            bandRasterWallMs: number[];
            artifacts: Artifact[];
        };
        type ActiveJob = {
            jobId: string;
            startedAt: number;
            captureBytes: boolean;
            current: { metadata: Metadata; chunks: ArrayBuffer[] } | null;
            artifactPromises: Array<Promise<Artifact>>;
            progressPhases: string[];
            bandRasterWallMs: number[];
            openBand: { index: number; total: number; startedAt: number } | null;
            resolve: (result: JobResult) => void;
            reject: (error: Error) => void;
            timeoutId: number;
        };

        const iframe = document.querySelector<HTMLIFrameElement>('#export-renderer');
        if (!iframe?.contentWindow) throw new Error('Export renderer iframe is unavailable.');
        if (iframe.contentDocument?.readyState !== 'complete') {
            await new Promise<void>((resolveLoad, rejectLoad) => {
                const timeout = window.setTimeout(() => rejectLoad(new Error('Export renderer iframe timed out.')), 15_000);
                iframe.addEventListener('load', () => {
                    window.clearTimeout(timeout);
                    resolveLoad();
                }, { once: true });
            });
        }

        const channel = new MessageChannel();
        let active: ActiveJob | null = null;

        const blobToBase64 = (blob: Blob) => new Promise<string>((resolveBase64, rejectBase64) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                const result = String(reader.result ?? '');
                resolveBase64(result.slice(result.indexOf(',') + 1));
            }, { once: true });
            reader.addEventListener('error', () => rejectBase64(reader.error ?? new Error('Blob read failed.')), { once: true });
            reader.readAsDataURL(blob);
        });

        const MAX_FOREGROUND_TILE_PIXELS = 1_000_000;
        const MAX_FOREGROUND_TILE_HEIGHT = 256;
        const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10] as const;
        const crcTable = new Uint32Array(256);
        for (let value = 0; value < crcTable.length; value += 1) {
            let current = value;
            for (let bit = 0; bit < 8; bit += 1) {
                current = (current & 1) !== 0
                    ? 0xedb88320 ^ (current >>> 1)
                    : current >>> 1;
            }
            crcTable[value] = current >>> 0;
        }

        const readUint32 = (bytes: Uint8Array, offset: number): number => (
            ((bytes[offset]! << 24)
                | (bytes[offset + 1]! << 16)
                | (bytes[offset + 2]! << 8)
                | bytes[offset + 3]!) >>> 0
        );

        const crc32 = (bytes: Uint8Array, start: number, end: number): number => {
            let crc = 0xffffffff;
            for (let offset = start; offset < end; offset += 1) {
                crc = crcTable[(crc ^ bytes[offset]!) & 0xff]! ^ (crc >>> 8);
            }
            return (crc ^ 0xffffffff) >>> 0;
        };

        const parsePngStructure = (bytes: Uint8Array, metadata: Metadata) => {
            if (bytes.length < pngSignature.length
                || pngSignature.some((value, index) => bytes[index] !== value)) {
                throw new Error('Artifact does not have a valid PNG signature.');
            }
            let offset = pngSignature.length;
            let chunkCount = 0;
            let idatChunkCount = 0;
            let idatEnded = false;
            let widthPx = 0;
            let heightPx = 0;
            let sawIhdr = false;
            let sawIend = false;

            while (offset < bytes.length) {
                if (offset + 12 > bytes.length) throw new Error('Artifact contains a truncated PNG chunk.');
                const length = readUint32(bytes, offset);
                const typeOffset = offset + 4;
                const dataOffset = typeOffset + 4;
                const dataEnd = dataOffset + length;
                const chunkEnd = dataEnd + 4;
                if (chunkEnd > bytes.length) throw new Error('Artifact PNG chunk length exceeds its payload.');
                const type = String.fromCharCode(
                    bytes[typeOffset]!,
                    bytes[typeOffset + 1]!,
                    bytes[typeOffset + 2]!,
                    bytes[typeOffset + 3]!,
                );
                if (crc32(bytes, typeOffset, dataEnd) !== readUint32(bytes, dataEnd)) {
                    throw new Error(`Artifact PNG ${type} chunk has an invalid CRC.`);
                }
                chunkCount += 1;

                if (type === 'IHDR') {
                    if (sawIhdr || chunkCount !== 1 || length !== 13) {
                        throw new Error('Artifact PNG has an invalid IHDR chunk.');
                    }
                    sawIhdr = true;
                    widthPx = readUint32(bytes, dataOffset);
                    heightPx = readUint32(bytes, dataOffset + 4);
                    if (bytes[dataOffset + 8] !== 8
                        || bytes[dataOffset + 9] !== 6
                        || bytes[dataOffset + 10] !== 0
                        || bytes[dataOffset + 11] !== 0
                        || bytes[dataOffset + 12] !== 0) {
                        throw new Error('Artifact PNG is not RGBA8 non-interlaced data with standard compression and filtering.');
                    }
                } else if (type === 'IDAT') {
                    if (!sawIhdr || idatEnded) throw new Error('Artifact PNG IDAT chunks are not contiguous.');
                    idatChunkCount += 1;
                } else {
                    if (idatChunkCount > 0) idatEnded = true;
                    if (type === 'IEND') {
                        if (sawIend || length !== 0 || chunkEnd !== bytes.length) {
                            throw new Error('Artifact PNG has an invalid IEND chunk.');
                        }
                        sawIend = true;
                    }
                }
                offset = chunkEnd;
            }

            if (!sawIhdr || idatChunkCount === 0 || !sawIend || offset !== bytes.length) {
                throw new Error('Artifact PNG is missing a required IHDR, IDAT, or IEND chunk.');
            }
            if (widthPx !== metadata.widthPx || heightPx !== metadata.heightPx) {
                throw new Error('Artifact PNG dimensions disagree with its metadata.');
            }
            return { chunkCount, idatChunkCount };
        };

        const scanForegroundByTiles = (image: HTMLImageElement) => {
            const width = image.naturalWidth;
            const tileHeight = Math.max(1, Math.min(
                MAX_FOREGROUND_TILE_HEIGHT,
                Math.floor(MAX_FOREGROUND_TILE_PIXELS / Math.max(1, width)),
            ));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = tileHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) throw new Error('Artifact foreground tile canvas is unavailable.');
            let nonWhitePixelCount = 0;
            for (let y = 0; y < image.naturalHeight; y += tileHeight) {
                const height = Math.min(tileHeight, image.naturalHeight - y);
                context.clearRect(0, 0, width, tileHeight);
                context.drawImage(image, 0, y, width, height, 0, 0, width, height);
                const pixels = context.getImageData(0, 0, width, height).data;
                for (let pixelOffset = 0; pixelOffset < pixels.length; pixelOffset += 4) {
                    if (pixels[pixelOffset + 3]! > 0 && (
                        pixels[pixelOffset]! < 250
                        || pixels[pixelOffset + 1]! < 250
                        || pixels[pixelOffset + 2]! < 250
                    )) {
                        nonWhitePixelCount += 1;
                    }
                }
            }
            return {
                nonWhitePixelCount,
                maxValidationCanvasWidth: width,
                maxValidationCanvasHeight: tileHeight,
                maxValidationCanvasPixels: width * tileHeight,
            };
        };

        const decodeArtifact = async (
            metadata: Metadata,
            chunks: ArrayBuffer[],
            captureBytes: boolean,
        ): Promise<Artifact> => {
            const blob = new Blob(chunks, { type: metadata.mimeType });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const pngStructure = parsePngStructure(bytes, metadata);
            const url = URL.createObjectURL(blob);
            const image = document.createElement('img');
            image.alt = 'Decoded renderer artifact';
            image.style.position = 'fixed';
            image.style.left = '-10000px';
            image.src = url;
            document.body.appendChild(image);
            try {
                await image.decode();
                const foreground = scanForegroundByTiles(image);
                return {
                    metadata,
                    decodedWidth: image.naturalWidth,
                    decodedHeight: image.naturalHeight,
                    ...foreground,
                    byteLength: blob.size,
                    pngChunkCount: pngStructure.chunkCount,
                    pngIdatChunkCount: pngStructure.idatChunkCount,
                    base64: captureBytes ? await blobToBase64(blob) : undefined,
                };
            } finally {
                image.remove();
                URL.revokeObjectURL(url);
            }
        };

        const failActive = (error: Error) => {
            if (!active) return;
            window.clearTimeout(active.timeoutId);
            const reject = active.reject;
            active = null;
            reject(error);
        };

        channel.port1.addEventListener('message', (event: MessageEvent<any>) => {
            const message = event.data;
            const state = active;
            if (!state || message?.jobId !== state.jobId) return;
            if (message.type === 'progress') {
                const phase = String(message.phase);
                state.progressPhases.push(phase);
                if (phase === 'rasterizing'
                    && Number.isInteger(message.completed)
                    && Number.isInteger(message.total)) {
                    if (state.openBand) {
                        failActive(new Error('A new raster band started before the previous band reached encoding.'));
                        return;
                    }
                    state.openBand = {
                        index: message.completed,
                        total: message.total,
                        startedAt: performance.now(),
                    };
                } else if (phase === 'encoding'
                    && Number.isInteger(message.completed)
                    && Number.isInteger(message.total)) {
                    const openBand = state.openBand;
                    if (!openBand
                        || openBand.index !== message.completed
                        || openBand.total !== message.total) {
                        failActive(new Error('Raster and encoding band progress is not contiguous.'));
                        return;
                    }
                    state.bandRasterWallMs.push(performance.now() - openBand.startedAt);
                    state.openBand = null;
                }
                return;
            }
            if (message.type === 'failed') {
                failActive(new Error(`${message.code}: ${message.message}`));
                return;
            }
            if (message.type === 'artifact-start') {
                if (state.current) {
                    failActive(new Error('Artifact started before the previous artifact completed.'));
                    return;
                }
                state.current = { metadata: message.metadata as Metadata, chunks: [] };
                return;
            }
            if (message.type === 'artifact-chunk') {
                if (!state.current || message.sequence !== state.current.chunks.length) {
                    failActive(new Error('Artifact chunks are not contiguous.'));
                    return;
                }
                state.current.chunks.push(message.bytes as ArrayBuffer);
                return;
            }
            if (message.type !== 'artifact-complete') return;
            if (!state.current) {
                failActive(new Error('Artifact completed before it started.'));
                return;
            }

            const { metadata, chunks } = state.current;
            state.current = null;
            state.artifactPromises.push(decodeArtifact(metadata, chunks, state.captureBytes));
            if (metadata.partNumber !== metadata.partCount) return;
            // Production rendering is complete when the final transferable artifact arrives.
            // PNG decode, full-pixel foreground scanning, and golden comparison are harness-only
            // validation work and must not be charged to the renderer performance number.
            const renderDurationMs = performance.now() - state.startedAt;

            void Promise.all(state.artifactPromises).then((artifacts) => {
                if (active !== state) return;
                window.clearTimeout(state.timeoutId);
                active = null;
                state.resolve({
                    durationMs: renderDurationMs,
                    validationDurationMs: performance.now() - state.startedAt - renderDurationMs,
                    progressPhases: state.progressPhases,
                    bandRasterWallMs: state.bandRasterWallMs,
                    artifacts,
                });
            }, (error) => failActive(error instanceof Error ? error : new Error(String(error))));
        });
        channel.port1.start();
        iframe.contentWindow.postMessage({
            v: 1,
            type: 'aimd:export-render-host:connect',
        }, window.location.origin, [channel.port2]);

        const runJob = (
            jobId: string,
            jobValue: unknown,
            captureBytes: boolean,
        ) => new Promise<JobResult>((resolveJob, rejectJob) => {
            if (active) {
                rejectJob(new Error('Harness attempted overlapping jobs.'));
                return;
            }
            const timeoutId = window.setTimeout(() => {
                failActive(new Error(`${jobId} timed out.`));
            }, 120_000);
            active = {
                jobId,
                startedAt: performance.now(),
                captureBytes,
                current: null,
                artifactPromises: [],
                progressPhases: [],
                bandRasterWallMs: [],
                openBand: null,
                resolve: resolveJob,
                reject: rejectJob,
                timeoutId,
            };
            channel.port1.postMessage({
                v: 1,
                type: 'start',
                jobId,
                job: jobValue,
            });
        });

        try {
            const messageJob = (documentValue: typeof shortDocument) => ({
                kind: 'message-png',
                document: documentValue,
                options: { widthCssPx: 480, requestedPixelRatio: 1 },
            });
            const shortCold = await runJob('short-cold', messageJob(shortDocument), true);
            const shortWarm = await runJob('short-warm', messageJob(shortDocument), false);
            const long = await runJob('long', messageJob(longDocument), false);
            const formulaPng = await runJob('formula-png', {
                kind: 'formula-asset',
                spec: {
                    source: String.raw`\underbrace{\ce{H2O + CO2}}_{\text{中文}} + \mathcal{F}`,
                    displayMode: true,
                    fontSizePx: 40,
                    foregroundColor: 'rgb(18, 52, 86)',
                },
                output: 'png',
            }, false);
            return { shortCold, shortWarm, long, formulaPng };
        } finally {
            channel.port1.close();
        }
    }, {
        shortDocument: documents.short,
        longDocument: documents.long,
    }) as Promise<PageHarnessResult>;
}

function validateJob(label: string, result: BrowserJobResult, requestedPixelRatio: number): void {
    invariant(Number.isFinite(result.durationMs) && result.durationMs > 0, `${label} duration is invalid`);
    invariant(result.artifacts.length > 0, `${label} returned no artifacts`);
    const partCount = result.artifacts[0]!.metadata.partCount;
    invariant(result.artifacts.length === partCount, `${label} returned ${result.artifacts.length}/${partCount} parts`);
    for (let index = 0; index < result.artifacts.length; index += 1) {
        const artifact = result.artifacts[index]!;
        const metadata = artifact.metadata;
        invariant(metadata.mimeType === 'image/png', `${label} returned ${metadata.mimeType}`);
        invariant(metadata.partNumber === index + 1, `${label} part numbering is not contiguous`);
        invariant(metadata.partCount === partCount, `${label} part counts disagree`);
        invariant(
            metadata.effectivePixelRatio >= 1 && metadata.effectivePixelRatio <= requestedPixelRatio,
            `${label} effective ratio ${metadata.effectivePixelRatio} is invalid`,
        );
        invariant(artifact.decodedWidth === metadata.widthPx, `${label} decoded width disagrees with metadata`);
        invariant(artifact.decodedHeight === metadata.heightPx, `${label} decoded height disagrees with metadata`);
        invariant(artifact.nonWhitePixelCount > 0, `${label} artifact contains no visible foreground pixels`);
        invariant(artifact.byteLength > 0, `${label} artifact is empty`);
        invariant(artifact.pngChunkCount >= 3, `${label} PNG structure is incomplete`);
        invariant(artifact.pngIdatChunkCount > 0, `${label} PNG contains no IDAT chunks`);
        invariant(
            artifact.maxValidationCanvasHeight <= 256,
            `${label} validation created a ${artifact.maxValidationCanvasHeight}px-tall canvas`,
        );
        invariant(
            artifact.maxValidationCanvasPixels <= 1_000_000,
            `${label} validation canvas exceeds its pixel budget`,
        );
    }
    invariant(result.progressPhases.includes('rasterizing'), `${label} did not report rasterizing progress`);
    invariant(result.progressPhases.includes('encoding'), `${label} did not report encoding progress`);
    invariant(
        result.bandRasterWallMs.every((duration) => Number.isFinite(duration) && duration > 0),
        `${label} contains an invalid band raster wall time`,
    );
}

function percentile(values: readonly number[], percentileValue: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);
    return sorted[index]!;
}

async function comparePngs(page: Page, actualBase64: string, goldenBase64: string): Promise<VisualComparison> {
    return page.evaluate(async ({ actual, golden, channelTolerance }) => {
        const decode = async (base64: string) => {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
            const image = new Image();
            image.src = url;
            try {
                await image.decode();
                const canvas = document.createElement('canvas');
                const decodedWidth = image.naturalWidth;
                const decodedHeight = image.naturalHeight;
                canvas.width = decodedWidth;
                canvas.height = decodedHeight;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) throw new Error('Golden comparison canvas is unavailable.');
                context.drawImage(image, 0, 0);
                return {
                    width: canvas.width,
                    height: canvas.height,
                    pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
                };
            } finally {
                URL.revokeObjectURL(url);
            }
        };

        const [actualImage, goldenImage] = await Promise.all([decode(actual), decode(golden)]);
        if (actualImage.width !== goldenImage.width || actualImage.height !== goldenImage.height) {
            const totalPixels = Math.max(
                actualImage.width * actualImage.height,
                goldenImage.width * goldenImage.height,
            );
            return {
                width: actualImage.width,
                height: actualImage.height,
                changedPixels: totalPixels,
                totalPixels,
                changedPixelRatio: 1,
            };
        }

        let changedPixels = 0;
        for (let offset = 0; offset < actualImage.pixels.length; offset += 4) {
            let changed = false;
            for (let channel = 0; channel < 4; channel += 1) {
                if (Math.abs(actualImage.pixels[offset + channel]! - goldenImage.pixels[offset + channel]!) > channelTolerance) {
                    changed = true;
                    break;
                }
            }
            if (changed) changedPixels += 1;
        }
        const totalPixels = actualImage.width * actualImage.height;
        return {
            width: actualImage.width,
            height: actualImage.height,
            changedPixels,
            totalPixels,
            changedPixelRatio: totalPixels === 0 ? 0 : changedPixels / totalPixels,
        };
    }, {
        actual: actualBase64,
        golden: goldenBase64,
        channelTolerance: VISUAL_GOLDEN_LIMITS.channelTolerance,
    });
}

async function handleGolden(
    page: Page,
    browserName: BrowserName,
    actualBase64: string,
    updateGoldens: boolean,
): Promise<VisualComparison & { updated: boolean }> {
    const directory = resolve('tests/fixtures/image-export/goldens');
    const path = resolve(directory, `${browserName}-short.png`);
    if (updateGoldens) {
        await mkdir(directory, { recursive: true });
        await writeFile(path, Buffer.from(actualBase64, 'base64'));
        const comparison = await comparePngs(page, actualBase64, actualBase64);
        return { ...comparison, updated: true };
    }

    invariant(
        await pathExists(path),
        `${path} is missing; run npm run harness:image-export:update-goldens`,
    );
    const goldenBase64 = (await readFile(path)).toString('base64');
    const comparison = await comparePngs(page, actualBase64, goldenBase64);
    invariant(
        comparison.changedPixelRatio <= VISUAL_GOLDEN_LIMITS.maxChangedPixelRatio,
        `${browserName} short golden changed ${(comparison.changedPixelRatio * 100).toFixed(3)}%`,
    );
    return { ...comparison, updated: false };
}

async function runBrowserHarness(
    config: typeof BROWSER_CONFIGS[number],
    server: HarnessServer,
    documents: { short: ExportDocumentV1; long: ExportDocumentV1 },
    longRepeat: number,
    updateGoldens: boolean,
): Promise<BrowserHarnessResult> {
    const browser = await config.launcher.launch({ headless: true });
    try {
        const context = await browser.newContext({
            colorScheme: 'light',
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'UTC',
            viewport: { width: 1280, height: 720 },
        });
        // The production bundle reads only runtime.id/getURL here; this shim keeps the real bundle on local HTTP.
        const runtimeBase = `${server.origin}/${config.name}/`;
        await context.addInitScript(`(() => {
            const runtime = { id: 'aimd-renderer-harness', getURL: (path) => ${JSON.stringify(runtimeBase)} + path };
            globalThis.chrome = { runtime };
            globalThis.browser = { runtime };
        })();`);
        const localRequests: string[] = [];
        const remoteRequests: string[] = [];
        await context.route('**/*', async (route) => {
            const url = route.request().url();
            if (url.startsWith(server.origin) || url.startsWith('blob:') || url.startsWith('data:')) {
                localRequests.push(url);
                await route.continue();
                return;
            }
            remoteRequests.push(url);
            await route.abort('blockedbyclient');
        });

        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
        await page.goto(`${server.origin}/harness.html?target=${config.name}`, { waitUntil: 'load' });
        const result = await executeRendererJobs(page, documents);

        validateJob(`${config.name} short cold`, result.shortCold, 1);
        validateJob(`${config.name} short warm`, result.shortWarm, 1);
        validateJob(`${config.name} long`, result.long, 1);
        validateJob(`${config.name} formula PNG`, result.formulaPng, 4);
        invariant(result.shortCold.artifacts.length === 1, `${config.name} short fixture was split`);
        invariant(result.shortWarm.artifacts.length === 1, `${config.name} warm short fixture was split`);
        if (longRepeat === CANONICAL_60K_REPEAT) {
            invariant(result.long.artifacts.length === 1, `${config.name} canonical 60k artifact was split`);
            const heightPx = result.long.artifacts[0]!.metadata.heightPx;
            invariant(
                heightPx >= MIN_60K_ARTIFACT_HEIGHT_PX && heightPx <= MAX_60K_ARTIFACT_HEIGHT_PX,
                `${config.name} canonical 60k artifact height ${heightPx}px is outside the locked range`,
            );
            invariant(result.long.bandRasterWallMs.length > 0, `${config.name} reported no 60k band timings`);
        }
        invariant(remoteRequests.length === 0, `${config.name} requested remote resources: ${remoteRequests.join(', ')}`);
        invariant(pageErrors.length === 0, `${config.name} page errors: ${pageErrors.join('\n')}`);

        const actualBase64 = result.shortCold.artifacts[0]!.base64;
        invariant(actualBase64, `${config.name} short artifact bytes were not captured`);
        const golden = await handleGolden(page, config.name, actualBase64, updateGoldens);
        await context.close();

        return {
            browser: config.name,
            localRequestCount: localRequests.length,
            remoteRequestCount: remoteRequests.length,
            short: {
                coldMs: Math.round(result.shortCold.durationMs * 100) / 100,
                warmMs: Math.round(result.shortWarm.durationMs * 100) / 100,
                coldValidationMs: Math.round(result.shortCold.validationDurationMs * 100) / 100,
                warmValidationMs: Math.round(result.shortWarm.validationDurationMs * 100) / 100,
                foregroundPixelCount: result.shortCold.artifacts.reduce(
                    (total, artifact) => total + artifact.nonWhitePixelCount,
                    0,
                ),
                metadata: result.shortCold.artifacts.map((artifact) => artifact.metadata),
                golden,
            },
            long: {
                durationMs: Math.round(result.long.durationMs * 100) / 100,
                validationDurationMs: Math.round(result.long.validationDurationMs * 100) / 100,
                foregroundPixelCount: result.long.artifacts.reduce(
                    (total, artifact) => total + artifact.nonWhitePixelCount,
                    0,
                ),
                maxBandRasterWallMs: Math.round(Math.max(0, ...result.long.bandRasterWallMs) * 100) / 100,
                p95BandRasterWallMs: Math.round(percentile(result.long.bandRasterWallMs, 0.95) * 100) / 100,
                maxValidationCanvasHeight: Math.max(
                    ...result.long.artifacts.map((artifact) => artifact.maxValidationCanvasHeight),
                ),
                maxValidationCanvasPixels: Math.max(
                    ...result.long.artifacts.map((artifact) => artifact.maxValidationCanvasPixels),
                ),
                pngIdatChunkCount: result.long.artifacts.reduce(
                    (total, artifact) => total + artifact.pngIdatChunkCount,
                    0,
                ),
                metadata: result.long.artifacts.map((artifact) => artifact.metadata),
            },
            formula: {
                pngDurationMs: Math.round(result.formulaPng.durationMs * 100) / 100,
                pngValidationDurationMs: Math.round(result.formulaPng.validationDurationMs * 100) / 100,
                foregroundPixelCount: result.formulaPng.artifacts.reduce(
                    (total, artifact) => total + artifact.nonWhitePixelCount,
                    0,
                ),
                metadata: result.formulaPng.artifacts.map((artifact) => artifact.metadata),
            },
        };
    } finally {
        await browser.close();
    }
}

function selectedBrowserNames(): BrowserName[] {
    const raw = process.argv.find((argument) => argument.startsWith('--browser='))?.slice('--browser='.length);
    if (!raw || raw === 'all') return ['chromium', 'firefox'];
    invariant(raw === 'chromium' || raw === 'firefox', `unknown --browser=${raw}`);
    return [raw];
}

export async function runImageExportBrowserHarness(): Promise<ImageExportBrowserHarnessReport> {
    const names = selectedBrowserNames();
    const configs = BROWSER_CONFIGS.filter((config) => names.includes(config.name));
    for (const config of configs) await assertBuiltRenderer(config.distDir);
    const documents = await loadCorpus();
    const updateGoldens = process.argv.includes('--update-goldens');
    const server = await createHarnessServer();
    try {
        const browsers: BrowserHarnessResult[] = [];
        for (const config of configs) {
            browsers.push(await runBrowserHarness(
                config,
                server,
                documents,
                documents.longRepeat,
                updateGoldens,
            ));
        }
        return {
            schemaVersion: 1,
            updateGoldens,
            longRepeat: documents.longRepeat,
            visualLimits: VISUAL_GOLDEN_LIMITS,
            browsers,
        };
    } finally {
        await server.close();
    }
}

runImageExportBrowserHarness().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
});
