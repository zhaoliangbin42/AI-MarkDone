import { PROTOCOL_VERSION, createRequestId } from '../../../contracts/protocol';
import {
    createInvalidResponseClientFailure,
    requestRuntimeClient,
    unwrapRuntimeClientResult,
} from '../../shared/clients/clientResult';
import type { PromptListContext, PromptRecord } from '../../../core/prompts/promptLibrary';
import { hasFields, isRecord, readArrayField } from '../../shared/clients/payloadValidation';

export type PromptLibraryClient = {
    listPrompts(options?: { context?: PromptListContext; query?: string; includeDisabled?: boolean }): Promise<PromptRecord[]>;
    savePrompt(prompt: Partial<PromptRecord> & { content: string }): Promise<PromptRecord>;
    deletePrompt(id: string): Promise<void>;
    restoreDefaults(): Promise<PromptRecord[]>;
    reorderPrompts?(ids: string[]): Promise<PromptRecord[]>;
    recordUse(id: string): Promise<void>;
};

function isPromptRecord(value: unknown): value is PromptRecord {
    if (!hasFields(value, ['id', 'title', 'content', 'triggerText'], ['createdAt', 'updatedAt'])) return false;
    if (typeof value.favorite !== 'boolean' || typeof value.enabled !== 'boolean') return false;
    if (!Array.isArray(value.contexts) || !value.contexts.every((context) => context === 'composer' || context === 'readerComment')) return false;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return false;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return false;
    if (value.lastUsedAt !== null && (typeof value.lastUsedAt !== 'number' || !Number.isFinite(value.lastUsedAt))) return false;
    if (value.managedDefaultId !== undefined && value.managedDefaultId !== null && typeof value.managedDefaultId !== 'string') return false;
    return value.managedDefaultVersion === undefined
        || value.managedDefaultVersion === null
        || (typeof value.managedDefaultVersion === 'number' && Number.isFinite(value.managedDefaultVersion));
}

function invalidPayload(message: string): never {
    return unwrapRuntimeClientResult(createInvalidResponseClientFailure(message));
}

function decodePromptList(value: unknown, type: string): PromptRecord[] {
    const prompts = readArrayField<PromptRecord>(value, 'prompts', isPromptRecord);
    return prompts ?? invalidPayload(`Invalid ${type} response payload`);
}

export function createPromptLibraryClient(): PromptLibraryClient {
    return {
        async listPrompts(options = {}) {
            const result = await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:list',
                payload: options,
            });
            if (!result.ok) return unwrapRuntimeClientResult(result);
            return decodePromptList(result.data, 'prompts:list');
        },
        async savePrompt(prompt) {
            const data = unwrapRuntimeClientResult(await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:save',
                payload: { prompt },
            }));
            return isRecord(data) && isPromptRecord(data.prompt)
                ? data.prompt
                : invalidPayload('Invalid prompts:save response payload');
        },
        async deletePrompt(id) {
            const data = unwrapRuntimeClientResult(await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:delete',
                payload: { id },
            }));
            if (!isRecord(data) || data.deleted !== true) {
                invalidPayload('Invalid prompts:delete response payload');
            }
        },
        async restoreDefaults() {
            const data = unwrapRuntimeClientResult(await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:restoreDefaults',
            }));
            return decodePromptList(data, 'prompts:restoreDefaults');
        },
        async reorderPrompts(ids) {
            const data = unwrapRuntimeClientResult(await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:reorder',
                payload: { ids },
            }));
            return decodePromptList(data, 'prompts:reorder');
        },
        async recordUse(id) {
            const data = unwrapRuntimeClientResult(await requestRuntimeClient<unknown>({
                v: PROTOCOL_VERSION,
                id: createRequestId(),
                type: 'prompts:recordUse',
                payload: { id },
            }));
            if (!isRecord(data) || data.recorded !== true) {
                invalidPayload('Invalid prompts:recordUse response payload');
            }
        },
    };
}
