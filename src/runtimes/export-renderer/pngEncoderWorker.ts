import { createStreamingPngEncoder, type StreamingPngEncoder } from '../../core/export/streamingPngEncoder';
import type {
    PngEncoderWorkerCommand,
    PngEncoderWorkerEvent,
} from '../../core/export/pngEncoderWorkerProtocol';

let encoder: StreamingPngEncoder | null = null;
let generation = 0;
let writeInProgress = false;
const ROWS_PER_SLICE = 32;
const yieldChannel = new MessageChannel();
const yieldQueue: Array<() => void> = [];

yieldChannel.port1.addEventListener('message', () => {
    yieldQueue.shift()?.();
});
yieldChannel.port1.start();

function send(event: PngEncoderWorkerEvent, transfer: Transferable[] = []): void {
    self.postMessage(event, { transfer });
}

function sendChunk(chunk: Uint8Array): void {
    const bytes = chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength
        ? chunk.buffer as ArrayBuffer
        : chunk.slice().buffer as ArrayBuffer;
    send({ type: 'chunk', bytes }, [bytes]);
}

function yieldToWorkerQueue(): Promise<void> {
    return new Promise((resolve) => {
        yieldQueue.push(resolve);
        yieldChannel.port2.postMessage(null);
    });
}

async function writeBand(command: Extract<PngEncoderWorkerCommand, { type: 'write-band' }>, token: number): Promise<void> {
    if (!encoder) throw new Error('PNG_ENCODER_NOT_ACTIVE');
    if (writeInProgress) throw new Error('PNG_ENCODER_WRITE_IN_PROGRESS');
    if (!Number.isSafeInteger(command.height) || command.height <= 0) throw new Error('PNG_ENCODER_INVALID_BAND');
    const rgba = new Uint8Array(command.rgba);
    const rowBytes = rgba.byteLength / command.height;
    if (!Number.isSafeInteger(rowBytes) || rowBytes <= 0) throw new Error('PNG_ENCODER_INVALID_BAND');
    writeInProgress = true;
    try {
        for (let row = 0; row < command.height; row += ROWS_PER_SLICE) {
            if (token !== generation || !encoder) return;
            const height = Math.min(ROWS_PER_SLICE, command.height - row);
            encoder.writeBand(
                command.y + row,
                height,
                rgba.subarray(row * rowBytes, (row + height) * rowBytes),
            );
            if (row + height < command.height) await yieldToWorkerQueue();
        }
        if (token === generation && encoder) {
            send({ type: 'band-written', y: command.y, height: command.height });
        }
    } catch (error: any) {
        if (token !== generation) return;
        encoder?.cancel();
        encoder = null;
        send({ type: 'failed', code: 'ENCODE_FAILED', message: error?.message || String(error) });
    } finally {
        if (token === generation) writeInProgress = false;
    }
}

self.addEventListener('message', (event: MessageEvent<PngEncoderWorkerCommand>) => {
    const command = event.data;
    try {
        switch (command.type) {
            case 'start':
                generation += 1;
                writeInProgress = false;
                encoder = createStreamingPngEncoder(sendChunk);
                encoder.start(command.width, command.height);
                send({ type: 'started' });
                break;
            case 'write-band':
                if (!encoder) throw new Error('PNG_ENCODER_NOT_ACTIVE');
                void writeBand(command, generation);
                break;
            case 'finish':
                if (!encoder) throw new Error('PNG_ENCODER_NOT_ACTIVE');
                if (writeInProgress) throw new Error('PNG_ENCODER_WRITE_IN_PROGRESS');
                encoder.finish();
                encoder = null;
                send({ type: 'complete' });
                break;
            case 'cancel':
                generation += 1;
                writeInProgress = false;
                encoder?.cancel();
                encoder = null;
                send({ type: 'cancelled' });
                break;
        }
    } catch (error: any) {
        encoder?.cancel();
        encoder = null;
        send({ type: 'failed', code: 'ENCODE_FAILED', message: error?.message || String(error) });
    }
});
