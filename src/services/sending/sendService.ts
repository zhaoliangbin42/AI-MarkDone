import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { SendErrorCode } from '../../core/sending/types';
import { clickSend, waitSendReady, writeComposer } from '../../drivers/content/sending/composerPort';

export function prepareSend(text: string): { ok: true; text: string } | { ok: false; code: 'EMPTY' } {
    if (text.length === 0) return { ok: false, code: 'EMPTY' };
    return { ok: true, text };
}

export async function sendText(
    adapter: SiteAdapter,
    text: string,
    options?: { focusComposer?: boolean; timeoutMs?: number }
): Promise<{ ok: true } | { ok: false; code: SendErrorCode; message: string }> {
    try {
        const prepared = prepareSend(text);
        if (!prepared.ok) return { ok: false, code: 'EMPTY', message: 'Empty message' };

        const writeRes = await writeComposer(adapter, prepared.text, { focus: options?.focusComposer ?? true, strategy: 'auto' });
        if (!writeRes.ok) return { ok: false, code: 'WRITE_FAILED', message: writeRes.message };

        const ready = await waitSendReady(adapter, options?.timeoutMs ?? 3000);
        if (!ready.ok) return { ok: false, code: 'SEND_BUTTON_NOT_READY', message: ready.message };

        const clicked = clickSend(adapter);
        if (!clicked.ok) return { ok: false, code: 'SEND_BUTTON_NOT_FOUND', message: clicked.message };

        return { ok: true };
    } catch (e) {
        return { ok: false, code: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Internal error' };
    }
}

