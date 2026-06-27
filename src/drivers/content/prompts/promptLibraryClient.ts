import { PROTOCOL_VERSION, createRequestId } from '../../../contracts/protocol';
import { sendExtRequest } from '../../shared/rpc';
import type { PromptListContext, PromptRecord } from '../../../core/prompts/promptLibrary';

export type PromptLibraryClient = {
    listPrompts(options?: { context?: PromptListContext; query?: string; includeDisabled?: boolean }): Promise<PromptRecord[]>;
    savePrompt(prompt: Partial<PromptRecord> & { content: string }): Promise<PromptRecord>;
    deletePrompt(id: string): Promise<void>;
    restoreDefaults(): Promise<PromptRecord[]>;
    reorderPrompts?(ids: string[]): Promise<PromptRecord[]>;
    recordUse(id: string): Promise<void>;
};

export function createPromptLibraryClient(): PromptLibraryClient {
    return {
        async listPrompts(options = {}) {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:list',
                payload: options,
            });
            if (!response.ok) throw new Error(response.error.message);
            const prompts = (response.data as { prompts?: PromptRecord[] } | undefined)?.prompts;
            return Array.isArray(prompts) ? prompts : [];
        },
        async savePrompt(prompt) {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:save',
                payload: { prompt },
            });
            if (!response.ok) throw new Error(response.error.message);
            const saved = (response.data as { prompt?: PromptRecord } | undefined)?.prompt;
            if (!saved) throw new Error('Prompt save returned no prompt');
            return saved;
        },
        async deletePrompt(id) {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:delete',
                payload: { id },
            });
            if (!response.ok) throw new Error(response.error.message);
        },
        async restoreDefaults() {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:restoreDefaults',
            });
            if (!response.ok) throw new Error(response.error.message);
            const prompts = (response.data as { prompts?: PromptRecord[] } | undefined)?.prompts;
            return Array.isArray(prompts) ? prompts : [];
        },
        async reorderPrompts(ids) {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:reorder',
                payload: { ids },
            });
            if (!response.ok) throw new Error(response.error.message);
            const prompts = (response.data as { prompts?: PromptRecord[] } | undefined)?.prompts;
            return Array.isArray(prompts) ? prompts : [];
        },
        async recordUse(id) {
            const response = await sendExtRequest({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:recordUse',
                payload: { id },
            });
            if (!response.ok) throw new Error(response.error.message);
        },
    };
}
