import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createStreamingPngEncoder, PngEncodingError } from '@/core/export/streamingPngEncoder';

type ParsedChunk = {
    type: string;
    data: Uint8Array;
    crc: number;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function joinBytes(parts: readonly Uint8Array[]): Uint8Array {
    const joined = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
    let offset = 0;
    for (const part of parts) {
        joined.set(part, offset);
        offset += part.byteLength;
    }
    return joined;
}

function readUint32(bytes: Uint8Array, offset: number): number {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function parseChunks(png: Uint8Array): ParsedChunk[] {
    const chunks: ParsedChunk[] = [];
    let offset = PNG_SIGNATURE.length;
    while (offset < png.byteLength) {
        const length = readUint32(png, offset);
        const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        chunks.push({ type, data: png.slice(dataStart, dataEnd), crc: readUint32(png, dataEnd) });
        offset = dataEnd + 4;
    }
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

function decodeRgbaScanlines(compressed: Uint8Array, width: number, height: number): Uint8Array {
    const filtered = unzlibSync(compressed);
    const rowBytes = width * 4;
    expect(filtered.byteLength).toBe((rowBytes + 1) * height);

    const rgba = new Uint8Array(rowBytes * height);
    for (let y = 0; y < height; y += 1) {
        const filter = filtered[y * (rowBytes + 1)]!;
        const filteredRow = filtered.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1));
        const rowOffset = y * rowBytes;
        const previousOffset = rowOffset - rowBytes;

        for (let x = 0; x < rowBytes; x += 1) {
            const left = x >= 4 ? rgba[rowOffset + x - 4]! : 0;
            const above = y > 0 ? rgba[previousOffset + x]! : 0;
            const upperLeft = y > 0 && x >= 4 ? rgba[previousOffset + x - 4]! : 0;
            const predictor = filter === 0
                ? 0
                : filter === 1
                    ? left
                    : filter === 2
                        ? above
                        : filter === 3
                            ? Math.floor((left + above) / 2)
                            : paeth(left, above, upperLeft);
            rgba[rowOffset + x] = (filteredRow[x]! + predictor) & 0xff;
        }
    }
    return rgba;
}

describe('streaming PNG encoder', () => {
    it('rejects dimensions that cannot be represented in PNG IHDR', () => {
        const encoder = createStreamingPngEncoder(() => undefined);

        expect(() => encoder.start(1, 0x1_0000_0000)).toThrowError(
            expect.objectContaining({ code: 'INVALID_DIMENSIONS' }),
        );
    });

    it('emits a valid RGBA8 PNG from contiguous bands without a full-height canvas', () => {
        const output: Uint8Array[] = [];
        const encoder = createStreamingPngEncoder((chunk) => output.push(chunk));
        const expected = new Uint8Array([
            255, 0, 0, 255, 0, 255, 0, 128,
            0, 0, 255, 255, 255, 255, 255, 0,
        ]);

        encoder.start(2, 2);
        encoder.writeBand(0, 1, expected.subarray(0, 8));
        encoder.writeBand(1, 1, expected.subarray(8));
        encoder.finish();

        const png = joinBytes(output);
        expect(Array.from(png.subarray(0, PNG_SIGNATURE.length))).toEqual(PNG_SIGNATURE);

        const chunks = parseChunks(png);
        expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
        expect(readUint32(chunks[0]!.data, 0)).toBe(2);
        expect(readUint32(chunks[0]!.data, 4)).toBe(2);
        expect(Array.from(chunks[0]!.data.subarray(8))).toEqual([8, 6, 0, 0, 0]);
        expect(chunks.at(-1)?.data).toHaveLength(0);
        for (const chunk of chunks) {
            const typeAndData = new Uint8Array(4 + chunk.data.byteLength);
            typeAndData.set(Array.from(chunk.type, (character) => character.charCodeAt(0)));
            typeAndData.set(chunk.data, 4);
            expect(chunk.crc, chunk.type).toBe(crc32(typeAndData));
        }

        const compressed = joinBytes(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
        expect(decodeRgbaScanlines(compressed, 2, 2)).toEqual(expected);
    });

    it('chooses an adaptive Up filter for a row that repeats the previous row', () => {
        const output: Uint8Array[] = [];
        const encoder = createStreamingPngEncoder((chunk) => output.push(chunk));
        const row = new Uint8Array([12, 34, 56, 255, 90, 123, 210, 128]);

        encoder.start(2, 2);
        encoder.writeBand(0, 1, row);
        encoder.writeBand(1, 1, row);
        encoder.finish();

        const chunks = parseChunks(joinBytes(output));
        const compressed = joinBytes(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
        const filtered = unzlibSync(compressed);
        expect(filtered[9]).toBe(2);
    });

    it.each([
        ['gap', 1],
        ['overlap', 0],
    ])('rejects a %s instead of accepting non-contiguous Y coverage', (_label, y) => {
        const encoder = createStreamingPngEncoder(() => undefined);
        encoder.start(1, 3);
        if (y === 0) encoder.writeBand(0, 1, new Uint8Array(4));

        let thrown: unknown;
        try {
            encoder.writeBand(y, 1, new Uint8Array(4));
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(PngEncodingError);
        expect(thrown).toMatchObject({ code: 'NON_CONTIGUOUS_BAND' });
    });

    it('stops emitting bytes after cancellation and rejects later work', () => {
        const output: Uint8Array[] = [];
        const encoder = createStreamingPngEncoder((chunk) => output.push(chunk));
        encoder.start(1, 2);
        encoder.writeBand(0, 1, new Uint8Array([1, 2, 3, 4]));
        encoder.cancel();
        const emittedBeforeRejectedWork = output.length;

        expect(() => encoder.writeBand(1, 1, new Uint8Array([5, 6, 7, 8]))).toThrowError(
            expect.objectContaining({ code: 'CANCELLED' }),
        );
        expect(() => encoder.finish()).toThrowError(expect.objectContaining({ code: 'CANCELLED' }));
        expect(output).toHaveLength(emittedBeforeRejectedWork);
    });

    it('emits large images as consecutive IDAT chunks belonging to one zlib stream', () => {
        const width = 64;
        const height = 256;
        const rgba = new Uint8Array(width * height * 4);
        let random = 0x12345678;
        for (let index = 0; index < rgba.byteLength; index += 1) {
            random ^= random << 13;
            random ^= random >>> 17;
            random ^= random << 5;
            rgba[index] = random >>> 24;
        }

        const output: Uint8Array[] = [];
        const encoder = createStreamingPngEncoder((chunk) => output.push(chunk));
        encoder.start(width, height);
        encoder.writeBand(0, 128, rgba.subarray(0, width * 128 * 4));
        encoder.writeBand(128, 128, rgba.subarray(width * 128 * 4));
        encoder.finish();

        const chunks = parseChunks(joinBytes(output));
        const idatIndices = chunks.flatMap((chunk, index) => chunk.type === 'IDAT' ? [index] : []);
        expect(idatIndices.length).toBeGreaterThan(1);
        expect(idatIndices).toEqual(
            Array.from({ length: idatIndices.length }, (_value, index) => idatIndices[0]! + index),
        );
        const compressed = joinBytes(idatIndices.map((index) => chunks[index]!.data));
        expect(decodeRgbaScanlines(compressed, width, height)).toEqual(rgba);
    });
});
