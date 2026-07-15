import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    __resetExportRendererForTests,
    __setExportRendererConnectorForTests,
    IframeExportRendererConnector,
    renderExportHostJob,
    type ExportRendererConnector,
} from '@/services/export/exportRenderer';
import { EXPORT_RENDER_HOST_PROTOCOL_VERSION } from '@/services/export/exportRenderHostProtocol';
import { browser } from '@/drivers/shared/browser';

const formulaJob = {
    kind: 'formula-asset' as const,
    spec: {
        source: 'x+y',
        displayMode: false,
        fontSizePx: 36,
        foregroundColor: '#171717',
    },
    output: 'svg' as const,
};

function emitSvg(port: MessagePort, jobId: string): void {
    port.postMessage({
        v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
        type: 'artifact-start',
        jobId,
        metadata: {
            mimeType: 'image/svg+xml',
            widthPx: 10,
            heightPx: 5,
            partNumber: 1,
            partCount: 1,
        },
    });
    const bytes = new TextEncoder().encode('<svg/>').buffer;
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

describe('renderExportHostJob', () => {
    afterEach(() => {
        __resetExportRendererForTests();
        vi.restoreAllMocks();
    });

    it('recreates the host and retries exactly once after a host-unavailable failure', async () => {
        let connections = 0;
        const teardown = vi.fn();
        const connector: ExportRendererConnector = {
            connect: async () => {
                connections += 1;
                const attempt = connections;
                const channel = new MessageChannel();
                channel.port2.addEventListener('message', (event) => {
                    if (event.data.type !== 'start') return;
                    if (attempt === 1) {
                        channel.port2.postMessage({
                            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
                            type: 'failed',
                            jobId: event.data.jobId,
                            code: 'HOST_UNAVAILABLE',
                            message: 'Host was removed.',
                        });
                    } else {
                        emitSvg(channel.port2, event.data.jobId);
                    }
                });
                channel.port2.start();
                return { port: channel.port1, teardown };
            },
            teardown,
        };
        __setExportRendererConnectorForTests(connector);

        const result = await renderExportHostJob(formulaJob);

        expect(result.artifacts).toHaveLength(1);
        expect(connections).toBe(2);
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('cancels a timed-out render without retrying the same expensive job', async () => {
        let connections = 0;
        const starts = vi.fn();
        const cancels = vi.fn();
        const connector: ExportRendererConnector = {
            connect: async () => {
                connections += 1;
                const channel = new MessageChannel();
                channel.port2.addEventListener('message', (event) => {
                    if (event.data.type === 'start') starts();
                    if (event.data.type === 'cancel') cancels();
                });
                channel.port2.start();
                return { port: channel.port1 };
            },
            teardown: vi.fn(),
        };
        __setExportRendererConnectorForTests(connector);

        await expect(renderExportHostJob(formulaJob, { timeoutMs: 5 })).rejects.toMatchObject({
            code: 'RENDER_FAILED',
        });
        await vi.waitFor(() => expect(cancels).toHaveBeenCalledTimes(1));

        expect(starts).toHaveBeenCalledTimes(1);
        expect(connections).toBe(1);
    });

    it('deduplicates concurrent jobs and reuses the completed byte cache', async () => {
        const starts = vi.fn();
        const connector: ExportRendererConnector = {
            connect: async () => {
                const channel = new MessageChannel();
                channel.port2.addEventListener('message', (event) => {
                    if (event.data.type !== 'start') return;
                    starts();
                    queueMicrotask(() => emitSvg(channel.port2, event.data.jobId));
                });
                channel.port2.start();
                return { port: channel.port1 };
            },
            teardown: vi.fn(),
        };
        __setExportRendererConnectorForTests(connector);

        const [first, second] = await Promise.all([
            renderExportHostJob(formulaJob),
            renderExportHostJob(formulaJob),
        ]);
        const cached = await renderExportHostJob(formulaJob);

        expect(starts).toHaveBeenCalledTimes(1);
        expect(first).toBe(second);
        expect(cached).toBe(first);
    });

    it('deduplicates signalled consumers without letting one cancellation abort the shared job', async () => {
        const starts: Array<{ port: MessagePort; jobId: string }> = [];
        const connector: ExportRendererConnector = {
            connect: async () => {
                const channel = new MessageChannel();
                channel.port2.addEventListener('message', (event) => {
                    if (event.data.type === 'start') starts.push({ port: channel.port2, jobId: event.data.jobId });
                });
                channel.port2.start();
                return { port: channel.port1 };
            },
            teardown: vi.fn(),
        };
        __setExportRendererConnectorForTests(connector);
        const firstAbort = new AbortController();
        const secondAbort = new AbortController();

        const first = renderExportHostJob(formulaJob, { signal: firstAbort.signal });
        const second = renderExportHostJob(formulaJob, { signal: secondAbort.signal });
        await vi.waitFor(() => expect(starts).toHaveLength(1));
        firstAbort.abort();

        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        expect(starts).toHaveLength(1);
        emitSvg(starts[0]!.port, starts[0]!.jobId);
        await expect(second).resolves.toMatchObject({ artifacts: [expect.any(Object)] });
        expect(starts).toHaveLength(1);
    });

    it('creates a fresh iframe immediately when the host page removes the resolved renderer node', async () => {
        vi.spyOn(browser.runtime, 'getURL').mockImplementation((path: string) => `chrome-extension://aimd/${path}`);
        const postMessage = vi.fn();
        vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue({ postMessage } as unknown as Window);
        const connector = new IframeExportRendererConnector();

        const firstConnectionPromise = connector.connect();
        const firstIframe = document.querySelector('iframe')!;
        firstIframe.dispatchEvent(new Event('load'));
        const firstConnection = await firstConnectionPromise;
        firstConnection.port.close();
        firstIframe.remove();

        const secondConnectionPromise = connector.connect();
        const secondIframe = document.querySelector('iframe')!;
        expect(secondIframe).not.toBe(firstIframe);
        secondIframe.dispatchEvent(new Event('load'));
        const secondConnection = await secondConnectionPromise;

        expect(postMessage).toHaveBeenCalledTimes(2);
        secondConnection.port.close();
        connector.teardown();
    });
});
