import { Zlib } from 'fflate';

export type PngChunkSink = (chunk: Uint8Array) => void;

export type PngEncodingErrorCode =
    | 'ALREADY_STARTED'
    | 'INVALID_DIMENSIONS'
    | 'NOT_ACTIVE'
    | 'NON_CONTIGUOUS_BAND'
    | 'INVALID_BAND_RANGE'
    | 'INVALID_BAND_DATA'
    | 'INCOMPLETE_IMAGE'
    | 'CANCELLED';

export class PngEncodingError extends Error {
    readonly name = 'PngEncodingError';

    constructor(readonly code: PngEncodingErrorCode) {
        super(code);
    }
}

export interface StreamingPngEncoder {
    start(width: number, height: number): void;
    writeBand(y: number, height: number, rgba: Uint8Array): void;
    finish(): void;
    cancel(): void;
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const EMPTY_BYTES = new Uint8Array(0);
const RGBA_BYTES_PER_PIXEL = 4;
const PNG_MAX_DIMENSION = 0x7fffffff;
const FILTER_SAMPLE_POINTS = 128;
const FILTER_BATCH_ROWS = 128;
const MIN_IDAT_CHUNK_BYTES = 64 * 1024;
const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_value, index) => {
    let entry = index;
    for (let bit = 0; bit < 8; bit += 1) {
        entry = (entry >>> 1) ^ (0xedb88320 & -(entry & 1));
    }
    return entry >>> 0;
});

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const result = new Uint8Array(12 + data.byteLength);
    const view = new DataView(result.buffer);
    view.setUint32(0, data.byteLength);
    for (let index = 0; index < 4; index += 1) {
        result[4 + index] = type.charCodeAt(index);
    }
    result.set(data, 8);
    view.setUint32(8 + data.byteLength, crc32(result.subarray(4, 8 + data.byteLength)));
    return result;
}

function ihdr(width: number, height: number): Uint8Array {
    const data = new Uint8Array(13);
    const view = new DataView(data.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    data.set([8, 6, 0, 0, 0], 8);
    return pngChunk('IHDR', data);
}

function paethPredictor(left: number, above: number, upperLeft: number): number {
    const prediction = left + above - upperLeft;
    const leftDistance = Math.abs(prediction - left);
    const aboveDistance = Math.abs(prediction - above);
    const upperLeftDistance = Math.abs(prediction - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
    if (aboveDistance <= upperLeftDistance) return above;
    return upperLeft;
}

function filteredByteScore(value: number): number {
    return Math.min(value, 256 - value);
}

function predictorForFilter(
    filter: number,
    raw: Uint8Array,
    previous: Uint8Array,
    index: number,
): number {
    const left = index >= RGBA_BYTES_PER_PIXEL ? raw[index - RGBA_BYTES_PER_PIXEL]! : 0;
    const above = previous[index]!;
    const upperLeft = index >= RGBA_BYTES_PER_PIXEL ? previous[index - RGBA_BYTES_PER_PIXEL]! : 0;
    if (filter === 0) return 0;
    if (filter === 1) return left;
    if (filter === 2) return above;
    if (filter === 3) return Math.floor((left + above) / 2);
    return paethPredictor(left, above, upperLeft);
}

function chooseRowFilter(raw: Uint8Array, previous: Uint8Array): number {
    // Sampling keeps filter selection adaptive without evaluating all five predictors over every byte.
    const stride = Math.max(1, Math.floor(raw.byteLength / FILTER_SAMPLE_POINTS));
    let bestFilter = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let filter = 0; filter <= 4; filter += 1) {
        let score = 0;
        for (let index = 0; index < raw.byteLength; index += stride) {
            const value = (raw[index]! - predictorForFilter(filter, raw, previous, index) + 256) & 0xff;
            score += filteredByteScore(value);
        }
        if (score < bestScore) {
            bestScore = score;
            bestFilter = filter;
        }
    }
    return bestFilter;
}

function filterScanline(
    raw: Uint8Array,
    previous: Uint8Array,
    output: Uint8Array,
): Uint8Array {
    const filter = chooseRowFilter(raw, previous);
    output[0] = filter;
    if (filter === 0) {
        output.set(raw, 1);
        return output;
    }
    for (let index = 0; index < raw.byteLength; index += 1) {
        output[index + 1] = (raw[index]! - predictorForFilter(filter, raw, previous, index) + 256) & 0xff;
    }
    return output;
}

class FflateStreamingPngEncoder implements StreamingPngEncoder {
    private width = 0;
    private height = 0;
    private nextY = 0;
    private previousRow = EMPTY_BYTES;
    private filterBatch = EMPTY_BYTES;
    private filterBatchRows = 0;
    private compressedParts: Uint8Array[] = [];
    private compressedBytes = 0;
    private compressor: Zlib | null = null;
    private state: 'idle' | 'active' | 'finished' | 'cancelled' = 'idle';

    constructor(private readonly onChunk: PngChunkSink) {}

    start(width: number, height: number): void {
        if (this.state !== 'idle') throw new PngEncodingError('ALREADY_STARTED');
        if (
            !Number.isSafeInteger(width)
            || !Number.isSafeInteger(height)
            || width <= 0
            || height <= 0
            || width > PNG_MAX_DIMENSION
            || height > PNG_MAX_DIMENSION
        ) {
            throw new PngEncodingError('INVALID_DIMENSIONS');
        }

        this.width = width;
        this.height = height;
        this.previousRow = new Uint8Array(width * RGBA_BYTES_PER_PIXEL);
        this.filterBatch = new Uint8Array(
            (width * RGBA_BYTES_PER_PIXEL + 1) * Math.min(FILTER_BATCH_ROWS, height),
        );
        this.filterBatchRows = 0;
        this.compressedParts = [];
        this.compressedBytes = 0;
        this.state = 'active';
        this.compressor = new Zlib({ level: 6 }, (data, final) => {
            if (this.state === 'cancelled' || data.byteLength === 0) return;
            this.compressedParts.push(data.slice());
            this.compressedBytes += data.byteLength;
            if (this.compressedBytes >= MIN_IDAT_CHUNK_BYTES || final) this.flushIdat();
        });

        this.onChunk(PNG_SIGNATURE.slice());
        this.onChunk(ihdr(width, height));
    }

    writeBand(y: number, height: number, rgba: Uint8Array): void {
        const compressor = this.requireActive();
        const rowBytes = this.width * 4;
        if (y !== this.nextY) throw new PngEncodingError('NON_CONTIGUOUS_BAND');
        if (!Number.isSafeInteger(height) || height <= 0 || y + height > this.height) {
            throw new PngEncodingError('INVALID_BAND_RANGE');
        }
        if (rgba.byteLength !== rowBytes * height) throw new PngEncodingError('INVALID_BAND_DATA');

        for (let row = 0; row < height; row += 1) {
            const raw = rgba.subarray(row * rowBytes, (row + 1) * rowBytes);
            const scanlineBytes = rowBytes + 1;
            const offset = this.filterBatchRows * scanlineBytes;
            const scanline = this.filterBatch.subarray(offset, offset + scanlineBytes);
            filterScanline(raw, this.previousRow, scanline);
            this.previousRow.set(raw);
            this.filterBatchRows += 1;
            if (this.filterBatchRows === FILTER_BATCH_ROWS) this.flushScanlines(compressor);
        }
        this.nextY += height;
    }

    finish(): void {
        const compressor = this.requireActive();
        if (this.nextY !== this.height) throw new PngEncodingError('INCOMPLETE_IMAGE');
        this.flushScanlines(compressor);
        compressor.push(EMPTY_BYTES, true);
        this.flushIdat();
        this.compressor = null;
        this.state = 'finished';
        this.onChunk(pngChunk('IEND', EMPTY_BYTES));
    }

    cancel(): void {
        if (this.state === 'finished' || this.state === 'cancelled') return;
        this.state = 'cancelled';
        this.compressor = null;
        this.filterBatchRows = 0;
        this.compressedParts = [];
        this.compressedBytes = 0;
    }

    private requireActive(): Zlib {
        if (this.state === 'cancelled') throw new PngEncodingError('CANCELLED');
        if (this.state !== 'active' || !this.compressor) throw new PngEncodingError('NOT_ACTIVE');
        return this.compressor;
    }

    private flushScanlines(compressor: Zlib): void {
        if (this.filterBatchRows === 0) return;
        const scanlineBytes = this.width * RGBA_BYTES_PER_PIXEL + 1;
        compressor.push(this.filterBatch.subarray(0, this.filterBatchRows * scanlineBytes));
        this.filterBatchRows = 0;
    }

    private flushIdat(): void {
        if (this.compressedBytes === 0) return;
        let data: Uint8Array;
        if (this.compressedParts.length === 1) {
            data = this.compressedParts[0]!;
        } else {
            data = new Uint8Array(this.compressedBytes);
            let offset = 0;
            for (const part of this.compressedParts) {
                data.set(part, offset);
                offset += part.byteLength;
            }
        }
        this.compressedParts = [];
        this.compressedBytes = 0;
        this.onChunk(pngChunk('IDAT', data));
    }
}

export function createStreamingPngEncoder(onChunk: PngChunkSink): StreamingPngEncoder {
    return new FflateStreamingPngEncoder(onChunk);
}
