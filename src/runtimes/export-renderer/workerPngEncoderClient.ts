import type {
    PngEncoderWorkerCommand,
    PngEncoderWorkerEvent,
} from '../../core/export/pngEncoderWorkerProtocol';

type PendingControl = {
    expected: PngEncoderWorkerEvent['type'];
    resolve: () => void;
    reject: (error: Error) => void;
};

export class WorkerPngEncoderClient {
    private pending: PendingControl | null = null;
    private cancelPromise: Promise<void> | null = null;
    private terminated = false;

    constructor(
        private readonly worker: Worker,
        private readonly onChunk: (bytes: ArrayBuffer) => void,
    ) {
        worker.addEventListener('message', this.handleMessage);
        worker.addEventListener('error', this.handleError);
    }

    start(width: number, height: number): Promise<void> {
        return this.sendAndWait({ type: 'start', width, height }, 'started');
    }

    writeBand(y: number, height: number, rgba: ArrayBuffer): Promise<void> {
        return this.sendAndWait({ type: 'write-band', y, height, rgba }, 'band-written', [rgba]);
    }

    finish(): Promise<void> {
        return this.sendAndWait({ type: 'finish' }, 'complete');
    }

    cancel(): Promise<void> {
        if (this.terminated) return Promise.resolve();
        if (this.cancelPromise) return this.cancelPromise;
        const interrupted = this.pending;
        this.pending = null;
        interrupted?.reject(createAbortError());
        const promise = this.sendAndWait({ type: 'cancel' }, 'cancelled');
        this.cancelPromise = promise;
        void promise.then(
            () => {
                if (this.cancelPromise === promise) this.cancelPromise = null;
            },
            () => {
                if (this.cancelPromise === promise) this.cancelPromise = null;
            },
        );
        return promise;
    }

    terminate(): void {
        if (this.terminated) return;
        this.terminated = true;
        this.pending?.reject(new Error('PNG encoder worker terminated.'));
        this.pending = null;
        this.worker.removeEventListener('message', this.handleMessage);
        this.worker.removeEventListener('error', this.handleError);
        this.worker.terminate();
    }

    private sendAndWait(
        command: PngEncoderWorkerCommand,
        expected: PngEncoderWorkerEvent['type'],
        transfer: Transferable[] = [],
    ): Promise<void> {
        if (this.terminated) return Promise.reject(new Error('PNG encoder worker terminated.'));
        if (this.pending) return Promise.reject(new Error('PNG encoder worker command overlap.'));
        return new Promise((resolve, reject) => {
            this.pending = { expected, resolve, reject };
            this.worker.postMessage(command, transfer);
        });
    }

    private readonly handleMessage = (event: MessageEvent<PngEncoderWorkerEvent>): void => {
        const message = event.data;
        if (message.type === 'chunk') {
            this.onChunk(message.bytes);
            return;
        }
        if (message.type === 'failed') {
            const error = new Error(message.message) as Error & { code: 'ENCODE_FAILED' };
            error.name = 'PngEncoderWorkerError';
            error.code = message.code;
            this.pending?.reject(error);
            this.pending = null;
            return;
        }
        if (this.pending?.expected !== message.type) return;
        this.pending.resolve();
        this.pending = null;
    };

    private readonly handleError = (event: ErrorEvent): void => {
        this.pending?.reject(new Error(event.message || 'PNG encoder worker failed.'));
        this.pending = null;
    };
}

function createAbortError(): Error {
    const error = new Error('PNG encoder worker command cancelled.');
    error.name = 'AbortError';
    return error;
}
