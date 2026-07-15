import { Zip, ZipPassThrough } from 'fflate';

export type ZipBlobFile = {
    filename: string;
    blob: Blob;
    chunks?: never;
};

export type ZipChunkFile = {
    filename: string;
    chunks: readonly ArrayBuffer[];
    blob?: never;
};

export type ZipBlobsArgs = {
    files: Array<ZipBlobFile | ZipChunkFile>;
    signal?: AbortSignal;
};

function createAbortError(): Error {
    const error = new Error('ZIP packaging was cancelled.');
    error.name = 'AbortError';
    return error;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw createAbortError();
}

function readBlob(blob: Blob): Promise<Uint8Array> {
    if (typeof blob.arrayBuffer === 'function') {
        return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('ZIP source blob could not be read.'));
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blob);
    });
}

export async function zipBlobs(args: ZipBlobsArgs): Promise<Blob> {
    throwIfAborted(args.signal);
    return new Promise<Blob>((resolve, reject) => {
        const chunks: ArrayBuffer[] = [];
        let settled = false;
        const settle = (outcome: { blob: Blob } | { error: unknown }) => {
            if (settled) return;
            settled = true;
            args.signal?.removeEventListener('abort', abort);
            if ('error' in outcome) {
                reject(outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error)));
            } else {
                resolve(outcome.blob);
            }
        };
        const zip = new Zip((error, chunk, final) => {
            if (error) {
                settle({ error });
                return;
            }
            if (chunk?.byteLength) {
                chunks.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
            }
            if (final) settle({ blob: new Blob(chunks, { type: 'application/zip' }) });
        });
        const abort = () => {
            zip.terminate();
            settle({ error: createAbortError() });
        };
        args.signal?.addEventListener('abort', abort, { once: true });

        void (async () => {
            try {
                for (const file of args.files) {
                    throwIfAborted(args.signal);
                    const entry = new ZipPassThrough(file.filename);
                    zip.add(entry);
                    if (file.chunks !== undefined) {
                        if (file.chunks.length === 0) {
                            entry.push(new Uint8Array(), true);
                        } else {
                            for (let index = 0; index < file.chunks.length; index += 1) {
                                throwIfAborted(args.signal);
                                entry.push(
                                    new Uint8Array(file.chunks[index]!),
                                    index === file.chunks.length - 1,
                                );
                            }
                        }
                    } else {
                        entry.push(await readBlob(file.blob), true);
                    }
                    throwIfAborted(args.signal);
                }
                zip.end();
            } catch (error) {
                zip.terminate();
                settle({ error });
            }
        })();
    });
}
