import {
    EXPORT_RENDER_HOST_CONNECT_TYPE,
    EXPORT_RENDER_HOST_PROTOCOL_VERSION,
    getRenderHostEventTransferables,
    isRenderHostCommand,
    type RenderHostEvent,
    type RenderHostJob,
} from '../../services/export/exportRenderHostProtocol';
import { ImageExportPlanningError } from '../../services/export/messagePngOutputPlan';
import type {
    ImageExportErrorCode,
    ImageExportProgressEvent,
} from '../../services/export/imageExportContracts';

type ActiveRenderJob = {
    jobId: string;
    controller: AbortController;
};

let active: ActiveRenderJob | null = null;

function post(port: MessagePort, event: RenderHostEvent): void {
    port.postMessage(event, getRenderHostEventTransferables(event));
}

function progress(port: MessagePort, jobId: string, event: ImageExportProgressEvent): void {
    post(port, {
        v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
        type: 'progress',
        jobId,
        phase: event.phase,
        completed: event.completed,
        total: event.total,
    });
}

function failureCode(error: unknown): ImageExportErrorCode {
    if (error instanceof Error && error.name === 'AbortError') return 'CANCELLED';
    if (error instanceof ImageExportPlanningError) return error.code;
    if (error instanceof Error && (error as Error & { code?: unknown }).code === 'ENCODE_FAILED') {
        return 'ENCODE_FAILED';
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('PNG_ENCODER_') || message.includes('PNG encoder')) return 'ENCODE_FAILED';
    return 'RENDER_FAILED';
}

async function runJob(port: MessagePort, jobId: string, job: RenderHostJob, signal: AbortSignal): Promise<void> {
    const commonSink = {
        onProgress: (event: any) => progress(port, jobId, event),
        onArtifactStart: (metadata: any) => post(port, {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'artifact-start',
            jobId,
            metadata,
        }),
        onArtifactChunk: (sequence: number, bytes: ArrayBuffer) => post(port, {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'artifact-chunk',
            jobId,
            sequence,
            bytes,
        }),
        onArtifactComplete: () => post(port, {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'artifact-complete',
            jobId,
        }),
    };

    progress(port, jobId, { phase: 'preparing' });
    if (job.kind === 'message-png') {
        const { renderMessagePngCapability } = await import('./messagePngCapability');
        await renderMessagePngCapability(job, commonSink, { signal });
        return;
    }
    const { renderFormulaAssetCapability } = await import('./formulaAssetCapability');
    await renderFormulaAssetCapability(job, commonSink, signal);
}

function connect(port: MessagePort): void {
    port.addEventListener('message', (event: MessageEvent<unknown>) => {
        if (!isRenderHostCommand(event.data)) {
            const envelope = event.data as { v?: unknown; type?: unknown; jobId?: unknown } | null;
            if (envelope?.v === EXPORT_RENDER_HOST_PROTOCOL_VERSION
                && envelope.type === 'start'
                && typeof envelope.jobId === 'string'
                && envelope.jobId.trim().length > 0) {
                post(port, {
                    v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
                    type: 'failed',
                    jobId: envelope.jobId,
                    code: 'INVALID_REQUEST',
                    message: 'Export renderer rejected an invalid job.',
                });
            }
            return;
        }
        const command = event.data;
        if (command.type === 'cancel') {
            if (active?.jobId === command.jobId) active.controller.abort();
            return;
        }
        if (active) {
            post(port, {
                v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
                type: 'failed',
                jobId: command.jobId,
                code: 'HOST_UNAVAILABLE',
                message: 'Export renderer is already processing a job.',
            });
            return;
        }

        const controller = new AbortController();
        active = { jobId: command.jobId, controller };
        void runJob(port, command.jobId, command.job, controller.signal)
            .catch((error: any) => {
                post(port, {
                    v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
                    type: 'failed',
                    jobId: command.jobId,
                    code: failureCode(error),
                    message: error?.message || String(error),
                });
            })
            .finally(() => {
                if (active?.jobId === command.jobId) active = null;
            });
    });
    port.start();
}

let connected = false;

window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const message = event.data as { v?: unknown; type?: unknown } | null;
    if ((event.source !== null && event.source !== window.parent)
        || message?.v !== EXPORT_RENDER_HOST_PROTOCOL_VERSION
        || message?.type !== EXPORT_RENDER_HOST_CONNECT_TYPE
        || !event.ports[0]
        || connected) {
        return;
    }
    connected = true;
    connect(event.ports[0]);
});
