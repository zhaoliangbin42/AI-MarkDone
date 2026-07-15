import { afterEach, describe, expect, it, vi } from 'vitest';

describe('export renderer entry', () => {
    afterEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it('returns INVALID_REQUEST for a versioned start envelope instead of timing out silently', async () => {
        await import('@/runtimes/export-renderer/entry');
        const channel = new MessageChannel();
        const response = new Promise<any>((resolve) => {
            channel.port1.addEventListener('message', (event) => resolve(event.data), { once: true });
            channel.port1.start();
        });

        window.dispatchEvent(new MessageEvent('message', {
            source: window,
            data: { v: 1, type: 'aimd:export-render-host:connect' },
            ports: [channel.port2],
        }));
        channel.port1.postMessage({
            v: 1,
            type: 'start',
            jobId: 'invalid-job',
            job: { kind: 'message-png', document: null, options: null },
        });

        await expect(response).resolves.toMatchObject({
            type: 'failed',
            jobId: 'invalid-job',
            code: 'INVALID_REQUEST',
        });
        channel.port1.close();
    });
});
