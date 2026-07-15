export type PngEncoderWorkerCommand =
    | { type: 'start'; width: number; height: number }
    | { type: 'write-band'; y: number; height: number; rgba: ArrayBuffer }
    | { type: 'finish' }
    | { type: 'cancel' };

export type PngEncoderWorkerEvent =
    | { type: 'started' }
    | { type: 'chunk'; bytes: ArrayBuffer }
    | { type: 'band-written'; y: number; height: number }
    | { type: 'complete' }
    | { type: 'cancelled' }
    | { type: 'failed'; code: 'ENCODE_FAILED'; message: string };
