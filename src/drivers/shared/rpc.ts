import type { ExtRequest, ExtResponse } from '../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../contracts/protocol';
import { browser } from './browser';

export type RpcOptions = {
    timeoutMs?: number;
};

function err(id: string, type: ExtRequest['type'], message: string): ExtResponse {
    return {
        v: PROTOCOL_VERSION,
        id,
        ok: false,
        type,
        error: { code: 'INTERNAL_ERROR', message },
    };
}

export async function sendExtRequest<T extends ExtRequest>(request: T, options?: RpcOptions): Promise<ExtResponse> {
    const timeoutMs = options?.timeoutMs ?? 8000;

    const send = async (): Promise<ExtResponse> => {
        try {
            const runtime: any = (browser as any)?.runtime;
            if (!runtime?.sendMessage) {
                return err(request.id, request.type, 'runtime.sendMessage is unavailable');
            }
            const res = await runtime.sendMessage(request);
            if (!res || typeof res !== 'object') {
                return err(request.id, request.type, 'Invalid response');
            }
            return res as ExtResponse;
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return err(request.id, request.type, msg || 'sendMessage failed');
        }
    };

    let timer: number | null = null;
    try {
        const timeout = new Promise<ExtResponse>((resolve) => {
            timer = window.setTimeout(() => resolve(err(request.id, request.type, 'Request timed out')), timeoutMs);
        });
        return await Promise.race([send(), timeout]);
    } finally {
        if (timer !== null) window.clearTimeout(timer);
    }
}

