type PendingExportTask<T> = {
    run: () => Promise<T>;
    signal?: AbortSignal;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
    abort: () => void;
};

const queue: Array<PendingExportTask<unknown>> = [];
let active: PendingExportTask<unknown> | null = null;

function createAbortError(): Error {
    const error = new Error('Image export cancelled.');
    error.name = 'AbortError';
    return error;
}

function removeAbortListener(task: PendingExportTask<unknown>): void {
    task.signal?.removeEventListener('abort', task.abort);
}

function pump(): void {
    if (active || queue.length === 0) return;
    const task = queue.shift()!;
    active = task;
    if (task.signal?.aborted) {
        removeAbortListener(task);
        active = null;
        task.reject(createAbortError());
        pump();
        return;
    }

    void task.run().then(task.resolve, task.reject).finally(() => {
        removeAbortListener(task);
        if (active === task) active = null;
        pump();
    });
}

/**
 * Serializes all high-memory export work in a tab, including the DOM-only formula
 * compatibility path that cannot be transferred into the extension iframe.
 */
export function runExclusiveExportTask<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(createAbortError());
    return new Promise<T>((resolve, reject) => {
        const task = {
            run,
            signal,
            resolve,
            reject,
            abort: () => {
                if (active === task) return;
                const index = queue.indexOf(task as PendingExportTask<unknown>);
                if (index < 0) return;
                queue.splice(index, 1);
                removeAbortListener(task as PendingExportTask<unknown>);
                reject(createAbortError());
            },
        } satisfies PendingExportTask<T>;
        signal?.addEventListener('abort', task.abort, { once: true });
        queue.push(task as PendingExportTask<unknown>);
        pump();
    });
}

export function __resetExportTaskSchedulerForTests(): void {
    const error = new Error('Export task scheduler reset.');
    for (const task of queue.splice(0)) {
        removeAbortListener(task);
        task.reject(error);
    }
    // Active work cannot be synchronously stopped here; production cancellation is
    // owned by its AbortSignal/host watchdog. Tests reset only after awaiting it.
    active = null;
}
