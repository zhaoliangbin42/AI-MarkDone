import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_RENDER_HOST_CANCEL_TIMEOUT_MS,
    DEFAULT_RENDER_HOST_IDLE_TIMEOUT_MS,
    ExportRenderHostClient,
    type RenderHostJobHandle,
} from '@/services/export/exportRenderHostClient';
import {
    EXPORT_RENDER_HOST_PROTOCOL_VERSION,
    type RenderHostCommand,
    type RenderHostJob,
} from '@/services/export/exportRenderHostProtocol';

const formulaJob: RenderHostJob = {
    kind: 'formula-asset',
    spec: {
        source: 'x+y',
        displayMode: false,
        fontSizePx: 36,
        foregroundColor: '#171717',
    },
    output: 'png',
};

function emitPng(port: MessagePort, jobId: string, value: number): void {
    const metadata = {
        mimeType: 'image/png' as const,
        widthPx: 1,
        heightPx: 1,
        effectivePixelRatio: 1,
        partNumber: 1,
        partCount: 1,
    };
    const bytes = new Uint8Array([value]).buffer;
    port.postMessage({
        v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
        type: 'artifact-start',
        jobId,
        metadata,
    });
    port.postMessage({
        v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
        type: 'artifact-chunk',
        jobId,
        sequence: 0,
        bytes,
    }, [bytes]);
    port.postMessage({
        v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
        type: 'artifact-complete',
        jobId,
    });
}

describe('ExportRenderHostClient', () => {
    let client: ExportRenderHostClient | null = null;
    let rendererPort: MessagePort | null = null;

    afterEach(() => {
        vi.useRealTimers();
        client?.dispose();
        rendererPort?.close();
        client = null;
        rendererPort = null;
    });

    it('runs one render at a time and advances a FIFO queue only after the active artifact completes', async () => {
        const channel = new MessageChannel();
        rendererPort = channel.port2;
        const commands: RenderHostCommand[] = [];
        rendererPort.addEventListener('message', (event) => commands.push(event.data));
        rendererPort.start();

        let nextId = 0;
        client = new ExportRenderHostClient({
            connect: async () => ({ port: channel.port1 }),
            createJobId: () => `job-${++nextId}`,
        });

        const first: RenderHostJobHandle = client.enqueue(formulaJob);
        const second: RenderHostJobHandle = client.enqueue({
            ...formulaJob,
            spec: { ...formulaJob.spec, source: 'a+b' },
        });

        await vi.waitFor(() => expect(commands.map((command) => command.jobId)).toEqual(['job-1']));
        emitPng(rendererPort, 'job-1', 17);

        await expect(first.result).resolves.toMatchObject({
            artifacts: [{ metadata: { partNumber: 1, partCount: 1 } }],
        });
        await vi.waitFor(() => expect(commands.map((command) => command.jobId)).toEqual(['job-1', 'job-2']));

        emitPng(rendererPort, 'job-2', 23);
        await expect(second.result).resolves.toMatchObject({
            artifacts: [{ metadata: { partNumber: 1, partCount: 1 } }],
        });
    });

    it('removes a cancelled queued job without sending it to the renderer', async () => {
        const channel = new MessageChannel();
        rendererPort = channel.port2;
        const commands: RenderHostCommand[] = [];
        rendererPort.addEventListener('message', (event) => commands.push(event.data));
        rendererPort.start();

        let nextId = 0;
        client = new ExportRenderHostClient({
            connect: async () => ({ port: channel.port1 }),
            createJobId: () => `job-${++nextId}`,
        });

        const first = client.enqueue(formulaJob);
        const queued = client.enqueue({
            ...formulaJob,
            spec: { ...formulaJob.spec, source: 'queued' },
        });
        await vi.waitFor(() => expect(commands).toHaveLength(1));

        queued.cancel();
        const cancellation = await Promise.race([
            queued.result.then(() => 'resolved', (error: Error) => error),
            new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 30)),
        ]);
        expect(cancellation).toMatchObject({ name: 'AbortError' });

        emitPng(rendererPort, first.jobId, 17);
        await first.result;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        expect(commands.map((command) => command.jobId)).toEqual([first.jobId]);
    });

    it('sends cancellation for the active job and waits for its terminal event before advancing', async () => {
        const channel = new MessageChannel();
        rendererPort = channel.port2;
        const commands: RenderHostCommand[] = [];
        rendererPort.addEventListener('message', (event) => commands.push(event.data));
        rendererPort.start();

        let nextId = 0;
        client = new ExportRenderHostClient({
            connect: async () => ({ port: channel.port1 }),
            createJobId: () => `job-${++nextId}`,
        });

        const active = client.enqueue(formulaJob);
        const queued = client.enqueue({
            ...formulaJob,
            spec: { ...formulaJob.spec, source: 'next' },
        });
        await vi.waitFor(() => expect(commands).toHaveLength(1));

        active.cancel();
        await expect(active.result).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => {
            expect(commands.map((command) => [command.type, command.jobId])).toEqual([
                ['start', active.jobId],
                ['cancel', active.jobId],
            ]);
        });

        rendererPort.postMessage({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'failed',
            jobId: active.jobId,
            code: 'CANCELLED',
            message: 'Cancelled.',
        });
        await vi.waitFor(() => expect(commands).toHaveLength(3));
        expect(commands[2]).toMatchObject({ type: 'start', jobId: queued.jobId });

        emitPng(rendererPort, queued.jobId, 23);
        await queued.result;
    });

    it('recreates a stuck host after the cancellation grace period and advances the FIFO queue', async () => {
        expect(DEFAULT_RENDER_HOST_CANCEL_TIMEOUT_MS).toBe(500);
        const rendererPorts: MessagePort[] = [];
        const commands: RenderHostCommand[] = [];
        const teardown = vi.fn();
        let nextId = 0;
        client = new ExportRenderHostClient({
            connect: async () => {
                const channel = new MessageChannel();
                rendererPorts.push(channel.port2);
                channel.port2.addEventListener('message', (event) => commands.push(event.data));
                channel.port2.start();
                return { port: channel.port1, teardown };
            },
            createJobId: () => `job-${++nextId}`,
            cancelTimeoutMs: 20,
        });

        const active = client.enqueue(formulaJob);
        const queued = client.enqueue({
            ...formulaJob,
            spec: { ...formulaJob.spec, source: 'after-stuck-cancel' },
        });
        await vi.waitFor(() => expect(commands).toHaveLength(1));

        active.cancel();
        await expect(active.result).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(commands.slice(0, 2).map((command) => command.type)).toEqual(['start', 'cancel']));
        await vi.waitFor(() => {
            expect(rendererPorts).toHaveLength(2);
            expect(commands.at(-1)).toMatchObject({ type: 'start', jobId: queued.jobId });
        }, { timeout: 100 });

        expect(teardown).toHaveBeenCalledTimes(1);
        emitPng(rendererPorts[1]!, queued.jobId, 23);
        await queued.result;
        rendererPorts.forEach((port) => port.close());
    });

    it('tears down an idle connection after the configurable 120-second-default timeout', async () => {
        expect(DEFAULT_RENDER_HOST_IDLE_TIMEOUT_MS).toBe(120_000);
        const channel = new MessageChannel();
        rendererPort = channel.port2;
        const commands: RenderHostCommand[] = [];
        rendererPort.addEventListener('message', (event) => commands.push(event.data));
        rendererPort.start();
        const teardown = vi.fn();
        client = new ExportRenderHostClient({
            connect: async () => ({ port: channel.port1, teardown }),
            createJobId: () => 'job-idle',
            idleTimeoutMs: 50,
        });

        const handle = client.enqueue(formulaJob);
        await vi.waitFor(() => expect(commands).toHaveLength(1));
        vi.useFakeTimers();
        emitPng(rendererPort, handle.jobId, 17);
        await handle.result;

        await vi.advanceTimersByTimeAsync(49);
        expect(teardown).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('rejects renderer failures with their stable error code intact', async () => {
        const channel = new MessageChannel();
        rendererPort = channel.port2;
        const commands: RenderHostCommand[] = [];
        rendererPort.addEventListener('message', (event) => commands.push(event.data));
        rendererPort.start();
        client = new ExportRenderHostClient({
            connect: async () => ({ port: channel.port1 }),
            createJobId: () => 'job-failed',
        });

        const handle = client.enqueue(formulaJob);
        await vi.waitFor(() => expect(commands).toHaveLength(1));
        rendererPort.postMessage({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'failed',
            jobId: handle.jobId,
            code: 'ENCODE_FAILED',
            message: 'PNG stream failed.',
        });

        await expect(handle.result).rejects.toMatchObject({
            name: 'ExportRenderHostError',
            code: 'ENCODE_FAILED',
            message: 'PNG stream failed.',
        });
    });

    it('fails fast with PROTOCOL_ERROR when artifact chunks are not contiguous', async () => {
        const channel = new MessageChannel();
        rendererPort = channel.port2;
        const commands: RenderHostCommand[] = [];
        rendererPort.addEventListener('message', (event) => commands.push(event.data));
        rendererPort.start();
        client = new ExportRenderHostClient({
            connect: async () => ({ port: channel.port1 }),
            createJobId: () => 'job-gap',
        });

        const handle = client.enqueue(formulaJob);
        await vi.waitFor(() => expect(commands).toHaveLength(1));
        rendererPort.postMessage({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'artifact-start',
            jobId: handle.jobId,
            metadata: {
                mimeType: 'image/png',
                widthPx: 1,
                heightPx: 1,
                effectivePixelRatio: 1,
                partNumber: 1,
                partCount: 1,
            },
        });
        const bytes = new Uint8Array([17]).buffer;
        rendererPort.postMessage({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'artifact-chunk',
            jobId: handle.jobId,
            sequence: 1,
            bytes,
        }, [bytes]);

        const outcome = await Promise.race([
            handle.result.then(() => 'resolved', (error: Error) => error),
            new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 50)),
        ]);
        expect(outcome).toMatchObject({
            name: 'ExportRenderHostError',
            code: 'PROTOCOL_ERROR',
        });
    });
});
