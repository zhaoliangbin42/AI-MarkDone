import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { armChatGPTSendPositionRestore } from '../../../drivers/content/chatgpt/sendPositionRestoreEvents';
import { readComposer, writeComposer } from '../../../drivers/content/sending/composerPort';
import { sendText } from '../../../services/sending/sendService';
import type { SendPort } from './SendPopover';

export function createContentSendPort(adapter: SiteAdapter): SendPort {
    return {
        readDraft: () => {
            const snap = readComposer(adapter);
            return snap.ok ? snap.text : '';
        },
        writeDraft: async (text) => {
            await writeComposer(adapter, text, { focus: false, strategy: 'auto' });
        },
        beforeSubmit: () => {
            armChatGPTSendPositionRestore();
        },
        submit: async (text) => sendText(adapter, text, { focusComposer: true, timeoutMs: 3000 }),
    };
}
