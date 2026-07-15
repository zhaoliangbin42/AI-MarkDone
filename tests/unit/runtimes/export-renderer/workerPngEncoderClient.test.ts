import { describe, expect, it, vi } from 'vitest';
import type {
    PngEncoderWorkerCommand,
    PngEncoderWorkerEvent,
} from '@/core/export/pngEncoderWorkerProtocol';
import { WorkerPngEncoderClient } from '@/runtimes/export-renderer/workerPngEncoderClient';

class ControlledWorker {
    readonly commands: PngEncoderWorkerCommand[] = [];
    private readonly messageListeners = new Set<(event: MessageEvent<PngEncoderWorkerEvent>) => void>();

    addEventListener(type: string, listener: EventListener): void {
        if (type === 'message') this.messageListeners.add(listener as (event: MessageEvent<PngEncoderWorkerEvent>) => void);
    }

    removeEventListener(type: string, listener: EventListener): void {
        if (type === 'message') this.messageListeners.delete(listener as (event: MessageEvent<PngEncoderWorkerEvent>) => void);
    }

    postMessage(command: PngEncoderWorkerCommand): void {
        this.commands.push(command);
        if (command.type === 'start') queueMicrotask(() => this.emit({ type: 'started' }));
    }

    terminate = vi.fn();

    emit(data: PngEncoderWorkerEvent): void {
        const event = { data } as MessageEvent<PngEncoderWorkerEvent>;
        for (const listener of this.messageListeners) listener(event);
    }
}

describe('WorkerPngEncoderClient', () => {
    it('preempts an in-flight band command and sends cancel to the worker', async () => {
        const worker = new ControlledWorker();
        const client = new WorkerPngEncoderClient(worker as unknown as Worker, vi.fn());
        await client.start(10, 10);

        const write = client.writeBand(0, 10, new ArrayBuffer(400));
        const cancel = client.cancel();

        await expect(write).rejects.toMatchObject({ name: 'AbortError' });
        expect(worker.commands.map((command) => command.type)).toEqual(['start', 'write-band', 'cancel']);
        worker.emit({ type: 'cancelled' });
        await expect(cancel).resolves.toBeUndefined();
    });
});
