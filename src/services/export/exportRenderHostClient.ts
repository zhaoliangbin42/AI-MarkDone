import {
    EXPORT_RENDER_HOST_PROTOCOL_VERSION,
    isRenderHostEvent,
    type RenderHostArtifactMetadata,
    type RenderHostEvent,
    type RenderHostJob,
} from './exportRenderHostProtocol';
import type {
    ImageExportErrorCode,
    ImageExportProgressEvent,
} from './imageExportContracts';

export const DEFAULT_RENDER_HOST_IDLE_TIMEOUT_MS = 120_000;
export const DEFAULT_RENDER_HOST_CANCEL_TIMEOUT_MS = 500;

export type RenderHostConnection = {
    port: MessagePort;
    teardown?: () => void | Promise<void>;
};

export type RenderHostClientOptions = {
    connect: () => RenderHostConnection | Promise<RenderHostConnection>;
    createJobId?: () => string;
    idleTimeoutMs?: number;
    cancelTimeoutMs?: number;
};

export type RenderHostArtifact = {
    metadata: RenderHostArtifactMetadata;
    chunks: ArrayBuffer[];
};

export type RenderHostJobResult = {
    artifacts: RenderHostArtifact[];
};

export type RenderHostEnqueueOptions = {
    onProgress?: (event: ImageExportProgressEvent) => void;
};

export type RenderHostJobHandle = {
    jobId: string;
    result: Promise<RenderHostJobResult>;
    cancel: () => void;
};

export class ExportRenderHostError extends Error {
    readonly code: ImageExportErrorCode;

    constructor(code: ImageExportErrorCode, message: string) {
        super(message);
        this.name = 'ExportRenderHostError';
        this.code = code;
    }
}

type PendingJob = {
    jobId: string;
    job: RenderHostJob;
    onProgress?: (event: ImageExportProgressEvent) => void;
    resolve: (result: RenderHostJobResult) => void;
    reject: (error: Error) => void;
    artifacts: RenderHostArtifact[];
    currentArtifact: RenderHostArtifact | null;
    started: boolean;
    cancelRequested: boolean;
};

export class ExportRenderHostClient {
    private readonly options: RenderHostClientOptions;
    private readonly queue: PendingJob[] = [];
    private active: PendingJob | null = null;
    private connection: RenderHostConnection | null = null;
    private connectionPromise: Promise<RenderHostConnection> | null = null;
    private nextJobId = 0;
    private disposed = false;
    private idleTimer: ReturnType<typeof setTimeout> | null = null;
    private cancelTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(options: RenderHostClientOptions) {
        this.options = options;
    }

    enqueue(job: RenderHostJob, options: RenderHostEnqueueOptions = {}): RenderHostJobHandle {
        if (this.disposed) throw new Error('Export render host client is disposed.');
        this.clearIdleTimer();
        const jobId = this.options.createJobId?.() ?? `export-${Date.now()}-${++this.nextJobId}`;
        let resolveResult!: (result: RenderHostJobResult) => void;
        let rejectResult!: (error: Error) => void;
        const result = new Promise<RenderHostJobResult>((resolve, reject) => {
            resolveResult = resolve;
            rejectResult = reject;
        });
        this.queue.push({
            jobId,
            job,
            onProgress: options.onProgress,
            resolve: resolveResult,
            reject: rejectResult,
            artifacts: [],
            currentArtifact: null,
            started: false,
            cancelRequested: false,
        });
        void this.pump();
        return {
            jobId,
            result,
            cancel: () => this.cancel(jobId),
        };
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        const error = new Error('Export render host client is disposed.');
        this.active?.reject(error);
        this.active = null;
        for (const pending of this.queue.splice(0)) pending.reject(error);
        this.clearIdleTimer();
        this.clearCancelTimer();
        this.disconnect();
    }

    private cancel(jobId: string): void {
        const queuedIndex = this.queue.findIndex((pending) => pending.jobId === jobId);
        if (queuedIndex >= 0) {
            const [pending] = this.queue.splice(queuedIndex, 1);
            pending?.reject(createAbortError());
            return;
        }

        const active = this.active;
        if (!active || active.jobId !== jobId || active.cancelRequested) return;
        active.cancelRequested = true;
        active.reject(createAbortError());
        if (!active.started) {
            this.finishActive(active);
            return;
        }
        this.connection?.port.postMessage({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'cancel',
            jobId,
        });
        this.scheduleCancelTimeout(active);
    }

    private async pump(): Promise<void> {
        if (this.disposed || this.active || this.queue.length === 0) return;
        const pending = this.queue.shift()!;
        this.active = pending;
        try {
            const connection = await this.ensureConnection();
            if (this.disposed || this.active !== pending) return;
            pending.started = true;
            connection.port.postMessage({
                v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
                type: 'start',
                jobId: pending.jobId,
                job: pending.job,
            });
        } catch (error) {
            pending.reject(error instanceof Error ? error : new Error(String(error)));
            this.finishActive(pending);
        }
    }

    private ensureConnection(): Promise<RenderHostConnection> {
        if (this.connection) return Promise.resolve(this.connection);
        if (this.connectionPromise) return this.connectionPromise;
        this.connectionPromise = Promise.resolve(this.options.connect()).then((connection) => {
            if (this.disposed) {
                connection.port.close();
                void connection.teardown?.();
                throw new Error('Export render host client is disposed.');
            }
            connection.port.addEventListener('message', this.handleMessage);
            connection.port.start();
            this.connection = connection;
            return connection;
        }).finally(() => {
            this.connectionPromise = null;
        });
        return this.connectionPromise;
    }

    private readonly handleMessage = (message: MessageEvent<unknown>): void => {
        if (!isRenderHostEvent(message.data)) return;
        const event = message.data;
        const pending = this.active;
        if (!pending || event.jobId !== pending.jobId) return;
        this.consumeEvent(pending, event);
    };

    private consumeEvent(pending: PendingJob, event: RenderHostEvent): void {
        switch (event.type) {
            case 'progress':
                pending.onProgress?.({
                    phase: event.phase,
                    completed: event.completed,
                    total: event.total,
                });
                return;
            case 'artifact-start':
                if (pending.currentArtifact
                    || event.metadata.partNumber !== pending.artifacts.length + 1
                    || (pending.artifacts.length > 0
                        && event.metadata.partCount !== pending.artifacts[0]?.metadata.partCount)) {
                    this.failProtocol(pending, 'Artifact metadata is out of sequence.');
                    return;
                }
                pending.currentArtifact = { metadata: event.metadata, chunks: [] };
                return;
            case 'artifact-chunk':
                if (!pending.currentArtifact || event.sequence !== pending.currentArtifact.chunks.length) {
                    this.failProtocol(pending, 'Artifact chunks must be contiguous and zero-based.');
                    return;
                }
                pending.currentArtifact.chunks.push(event.bytes);
                return;
            case 'artifact-complete': {
                const artifact = pending.currentArtifact;
                if (!artifact) {
                    this.failProtocol(pending, 'Artifact completed before it started.');
                    return;
                }
                pending.artifacts.push(artifact);
                pending.currentArtifact = null;
                if (artifact.metadata.partNumber === artifact.metadata.partCount) {
                    pending.resolve({ artifacts: pending.artifacts });
                    this.finishActive(pending);
                }
                return;
            }
            case 'failed':
                pending.reject(new ExportRenderHostError(event.code, event.message));
                this.finishActive(pending);
        }
    }

    private failProtocol(pending: PendingJob, message: string): void {
        pending.reject(new ExportRenderHostError('PROTOCOL_ERROR', message));
        this.disconnect();
        this.finishActive(pending);
    }

    private finishActive(pending: PendingJob): void {
        if (this.active !== pending) return;
        this.clearCancelTimer();
        this.active = null;
        if (this.queue.length === 0) this.scheduleIdleTeardown();
        void this.pump();
    }

    private scheduleIdleTeardown(): void {
        this.clearIdleTimer();
        const timeoutMs = this.options.idleTimeoutMs ?? DEFAULT_RENDER_HOST_IDLE_TIMEOUT_MS;
        this.idleTimer = setTimeout(() => {
            this.idleTimer = null;
            if (this.active || this.queue.length > 0) return;
            this.disconnect();
        }, timeoutMs);
    }

    private clearIdleTimer(): void {
        if (this.idleTimer === null) return;
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
    }

    private scheduleCancelTimeout(pending: PendingJob): void {
        this.clearCancelTimer();
        const timeoutMs = this.options.cancelTimeoutMs ?? DEFAULT_RENDER_HOST_CANCEL_TIMEOUT_MS;
        this.cancelTimer = setTimeout(() => {
            this.cancelTimer = null;
            if (this.active !== pending || !pending.cancelRequested) return;
            // A renderer that never acknowledges cancellation must not hold the per-tab FIFO forever.
            // Dropping its private channel also removes the iframe through the connection teardown.
            this.disconnect();
            this.finishActive(pending);
        }, Math.max(0, timeoutMs));
    }

    private clearCancelTimer(): void {
        if (this.cancelTimer === null) return;
        clearTimeout(this.cancelTimer);
        this.cancelTimer = null;
    }

    private disconnect(): void {
        const connection = this.connection;
        this.connection = null;
        if (!connection) return;
        connection.port.removeEventListener('message', this.handleMessage);
        connection.port.close();
        void connection.teardown?.();
    }
}

function createAbortError(): Error {
    const error = new Error('Export render job was cancelled.');
    error.name = 'AbortError';
    return error;
}
