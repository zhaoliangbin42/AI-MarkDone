import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzlibSync } from 'fflate';
import { createStreamingPngEncoder } from '../src/core/export/streamingPngEncoder';
import {
    MESSAGE_PNG_LIMITS,
    planMessagePngOutput,
} from '../src/services/export/messagePngOutputPlan';
import { IMAGE_EXPORT_LONG_FIXTURES } from './fixtures/image-export-long';

type ParsedPngChunk = {
    type: string;
    data: Uint8Array;
};

export type ImageExportBenchmarkFixtureResult = {
    name: string;
    widthCssPx: number;
    heightCssPx: number;
    requestedPixelRatio: number;
    effectivePixelRatio: number;
    pixelWidth: number;
    pixelHeight: number;
    partCount: number;
    maxBandPixelHeight: number;
    maxBandDevicePixels: number;
    durationMs: number;
    png: {
        decoded: true;
        widthPx: number;
        heightPx: number;
        byteLength: number;
        idatChunkCount: number;
    };
};

export type ImageExportBenchmarkReport = {
    schemaVersion: 1;
    encoderProbeWidthPx: number;
    totalDurationMs: number;
    fixtures: ImageExportBenchmarkFixtureResult[];
};

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
// Full-width limits are verified by the planner; a narrow probe keeps structural PNG decoding fast in every test run.
const ENCODER_PROBE_WIDTH_PX = 4;
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_value, index) => {
    let entry = index;
    for (let bit = 0; bit < 8; bit += 1) {
        entry = (entry >>> 1) ^ (0xedb88320 & -(entry & 1));
    }
    return entry >>> 0;
});

function invariant(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(`Image export benchmark gate failed: ${message}`);
}

function joinBytes(parts: readonly Uint8Array[]): Uint8Array {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.byteLength;
    }
    return result;
}

function readUint32(bytes: Uint8Array, offset: number): number {
    invariant(offset >= 0 && offset + 4 <= bytes.byteLength, `uint32 read exceeds ${bytes.byteLength} bytes`);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function parsePng(png: Uint8Array): ParsedPngChunk[] {
    invariant(png.byteLength >= PNG_SIGNATURE.byteLength, 'PNG is shorter than its signature');
    invariant(PNG_SIGNATURE.every((byte, index) => png[index] === byte), 'PNG signature is invalid');

    const chunks: ParsedPngChunk[] = [];
    let offset = PNG_SIGNATURE.byteLength;
    while (offset < png.byteLength) {
        const dataLength = readUint32(png, offset);
        const typeStart = offset + 4;
        const dataStart = typeStart + 4;
        const dataEnd = dataStart + dataLength;
        const chunkEnd = dataEnd + 4;
        invariant(chunkEnd <= png.byteLength, `PNG chunk at ${offset} exceeds the artifact length`);

        const typeBytes = png.subarray(typeStart, dataStart);
        const type = String.fromCharCode(...typeBytes);
        const data = png.slice(dataStart, dataEnd);
        const typeAndData = png.subarray(typeStart, dataEnd);
        invariant(readUint32(png, dataEnd) === crc32(typeAndData), `${type} CRC32 is invalid`);
        chunks.push({ type, data });
        offset = chunkEnd;
    }

    invariant(offset === png.byteLength, 'PNG has trailing or truncated bytes');
    return chunks;
}

function paeth(left: number, above: number, upperLeft: number): number {
    const prediction = left + above - upperLeft;
    const leftDistance = Math.abs(prediction - left);
    const aboveDistance = Math.abs(prediction - above);
    const upperLeftDistance = Math.abs(prediction - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
    if (aboveDistance <= upperLeftDistance) return above;
    return upperLeft;
}

function expectedChannel(x: number, y: number, channel: number): number {
    if (channel === 0) return (y * 17 + x * 31) & 0xff;
    if (channel === 1) return (y * 7 + x * 13) & 0xff;
    if (channel === 2) return (y ^ x) & 0xff;
    return 255;
}

function createProbeBand(width: number, startY: number, height: number): Uint8Array {
    const rgba = new Uint8Array(width * height * 4);
    for (let localY = 0; localY < height; localY += 1) {
        const y = startY + localY;
        for (let x = 0; x < width; x += 1) {
            const pixelOffset = (localY * width + x) * 4;
            for (let channel = 0; channel < 4; channel += 1) {
                rgba[pixelOffset + channel] = expectedChannel(x, y, channel);
            }
        }
    }
    return rgba;
}

function decodeAndVerifyScanlines(compressed: Uint8Array, width: number, height: number): void {
    const filtered = unzlibSync(compressed);
    const rowBytes = width * 4;
    invariant(filtered.byteLength === (rowBytes + 1) * height, 'decoded scanline length is invalid');

    let previous = new Uint8Array(rowBytes);
    let current = new Uint8Array(rowBytes);
    for (let y = 0; y < height; y += 1) {
        const scanlineOffset = y * (rowBytes + 1);
        const filter = filtered[scanlineOffset]!;
        invariant(filter <= 4, `row ${y} uses unsupported filter ${filter}`);
        const source = filtered.subarray(scanlineOffset + 1, scanlineOffset + rowBytes + 1);

        for (let byteIndex = 0; byteIndex < rowBytes; byteIndex += 1) {
            const left = byteIndex >= 4 ? current[byteIndex - 4]! : 0;
            const above = previous[byteIndex]!;
            const upperLeft = byteIndex >= 4 ? previous[byteIndex - 4]! : 0;
            const predictor = filter === 0
                ? 0
                : filter === 1
                    ? left
                    : filter === 2
                        ? above
                        : filter === 3
                            ? Math.floor((left + above) / 2)
                            : paeth(left, above, upperLeft);
            current[byteIndex] = (source[byteIndex]! + predictor) & 0xff;
            const x = Math.floor(byteIndex / 4);
            const channel = byteIndex % 4;
            invariant(
                current[byteIndex] === expectedChannel(x, y, channel),
                `decoded RGBA mismatch at (${x}, ${y}) channel ${channel}`,
            );
        }
        [previous, current] = [current, previous];
        current.fill(0);
    }
}

function encodeAndVerifyProbe(height: number, bandHeight: number) {
    const output: Uint8Array[] = [];
    const encoder = createStreamingPngEncoder((chunk) => output.push(chunk));
    encoder.start(ENCODER_PROBE_WIDTH_PX, height);
    for (let y = 0; y < height; y += bandHeight) {
        const currentBandHeight = Math.min(bandHeight, height - y);
        encoder.writeBand(y, currentBandHeight, createProbeBand(ENCODER_PROBE_WIDTH_PX, y, currentBandHeight));
    }
    encoder.finish();

    const png = joinBytes(output);
    const chunks = parsePng(png);
    invariant(chunks[0]?.type === 'IHDR', 'first chunk is not IHDR');
    invariant(chunks.at(-1)?.type === 'IEND', 'last chunk is not IEND');
    invariant(chunks[0]?.data.byteLength === 13, 'IHDR length is invalid');
    invariant(readUint32(chunks[0]!.data, 0) === ENCODER_PROBE_WIDTH_PX, 'IHDR width is invalid');
    invariant(readUint32(chunks[0]!.data, 4) === height, 'IHDR height is invalid');
    invariant(
        chunks[0]!.data.subarray(8).every((byte, index) => byte === [8, 6, 0, 0, 0][index]),
        'IHDR is not non-interlaced RGBA8',
    );

    const idatIndices = chunks.flatMap((chunk, index) => chunk.type === 'IDAT' ? [index] : []);
    invariant(idatIndices.length > 0, 'PNG has no IDAT chunks');
    invariant(
        idatIndices.every((chunkIndex, index) => chunkIndex === idatIndices[0]! + index),
        'IDAT chunks are not consecutive',
    );
    const compressed = joinBytes(idatIndices.map((index) => chunks[index]!.data));
    decodeAndVerifyScanlines(compressed, ENCODER_PROBE_WIDTH_PX, height);

    return {
        decoded: true as const,
        widthPx: ENCODER_PROBE_WIDTH_PX,
        heightPx: height,
        byteLength: png.byteLength,
        idatChunkCount: idatIndices.length,
    };
}

export function runImageExportBenchmark(): ImageExportBenchmarkReport {
    const benchmarkStartedAt = performance.now();
    const fixtures = IMAGE_EXPORT_LONG_FIXTURES.map((fixture) => {
        const startedAt = performance.now();
        const plan = planMessagePngOutput(fixture);
        const maxBandDevicePixels = plan.pixelWidth * plan.maxBandPixelHeight;

        invariant(plan.effectivePixelRatio >= 1, `${fixture.name} fell below 1x`);
        invariant(maxBandDevicePixels <= MESSAGE_PNG_LIMITS.maxBandPixels, `${fixture.name} band exceeds 8M pixels`);
        invariant(plan.partCount === 1, `${fixture.name} unexpectedly requires ${plan.partCount} parts`);
        if (fixture.heightCssPx === 60_000) {
            invariant(plan.effectivePixelRatio === 1, '60k fixture did not stop at 1x');
        }

        const png = encodeAndVerifyProbe(plan.pixelHeight, plan.maxBandPixelHeight);
        return {
            ...fixture,
            effectivePixelRatio: plan.effectivePixelRatio,
            pixelWidth: plan.pixelWidth,
            pixelHeight: plan.pixelHeight,
            partCount: plan.partCount,
            maxBandPixelHeight: plan.maxBandPixelHeight,
            maxBandDevicePixels,
            durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
            png,
        };
    });

    return {
        schemaVersion: 1,
        encoderProbeWidthPx: ENCODER_PROBE_WIDTH_PX,
        totalDurationMs: Math.round((performance.now() - benchmarkStartedAt) * 100) / 100,
        fixtures,
    };
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === entryPath) {
    try {
        process.stdout.write(`${JSON.stringify(runImageExportBenchmark(), null, 2)}\n`);
    } catch (error) {
        console.error(error instanceof Error ? error.stack ?? error.message : error);
        process.exitCode = 1;
    }
}
