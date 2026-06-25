import type { ExtRequest, ExtResponse, ProtocolErrorCode } from '../../../contracts/protocol';
import { PROTOCOL_VERSION } from '../../../contracts/protocol';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../../contracts/storage';
import { localStoragePort } from '../../../drivers/background/storage/localStoragePort';
import { syncStoragePort } from '../../../drivers/background/storage/syncStoragePort';
import { backgroundStorageQueue } from '../../../drivers/background/storage/asyncQueue';
import { loadAndNormalize } from '../../../services/settings/settingsService';
import {
    addMissingDefaultComposerPrompts,
    filterPromptRecords,
    normalizePromptForSave,
    normalizePromptLibrary,
    type PromptListContext,
    type PromptLibraryV1,
} from '../../../core/prompts/promptLibrary';

type HandlerResult = { response: ExtResponse };

function ok(id: string, type: ExtRequest['type'], data?: unknown): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: true, type, data };
}

function err(id: string, type: ExtRequest['type'], code: ProtocolErrorCode, message: string): ExtResponse {
    return { v: PROTOCOL_VERSION, id, ok: false, type, error: { code, message } };
}

async function loadReaderCommentPrompts() {
    const raw = await syncStoragePort.get(LEGACY_STORAGE_KEYS.appSettingsKey);
    const settings = loadAndNormalize(raw[LEGACY_STORAGE_KEYS.appSettingsKey]);
    return settings.reader.commentExport.prompts;
}

async function loadLibrary(): Promise<PromptLibraryV1> {
    const raw = await localStoragePort.get(STORAGE_KEYS.promptLibraryV1);
    const existing = raw[STORAGE_KEYS.promptLibraryV1];
    const library = normalizePromptLibrary(existing, {
        readerCommentPrompts: await loadReaderCommentPrompts(),
    });
    if (existing !== library) {
        await localStoragePort.set({ [STORAGE_KEYS.promptLibraryV1]: library });
    }
    return library;
}

async function saveLibrary(library: PromptLibraryV1): Promise<void> {
    await localStoragePort.set({ [STORAGE_KEYS.promptLibraryV1]: library });
}

function normalizeContext(value: unknown): PromptListContext {
    return value === 'composer' || value === 'readerComment' ? value : 'all';
}

function hasComposerTriggerConflict(library: PromptLibraryV1, prompt: ReturnType<typeof normalizePromptForSave>): boolean {
    if (!prompt.triggerText) return false;
    return library.prompts.some((entry) => (
        entry.id !== prompt.id
        && entry.triggerText === prompt.triggerText
    ));
}

export async function handlePromptsRequest(request: ExtRequest): Promise<HandlerResult | null> {
    if (!request.type.startsWith('prompts:')) return null;

    switch (request.type) {
        case 'prompts:list': {
            const library = await loadLibrary();
            const payload = request.payload ?? {};
            const context = normalizeContext(payload.context);
            const query = typeof payload.query === 'string' ? payload.query : '';
            const includeDisabled = payload.includeDisabled === true;
            return {
                response: ok(request.id, request.type, {
                    prompts: filterPromptRecords(library.prompts, { context, query, includeDisabled }),
                }),
            };
        }
        case 'prompts:save': {
            return backgroundStorageQueue.enqueue(async () => {
                const library = await loadLibrary();
                const prompt = normalizePromptForSave(request.payload.prompt);
                if (!prompt.content.trim()) {
                    return { response: err(request.id, request.type, 'INVALID_REQUEST', 'Prompt content is required') };
                }
                if (hasComposerTriggerConflict(library, prompt)) {
                    return { response: err(request.id, request.type, 'CONFLICT', 'Prompt trigger text already exists') };
                }
                const prompts = [
                    ...library.prompts.filter((entry) => entry.id !== prompt.id),
                    prompt,
                ];
                const next = { ...library, prompts };
                await saveLibrary(next);
                return { response: ok(request.id, request.type, { prompt }) };
            });
        }
        case 'prompts:delete': {
            return backgroundStorageQueue.enqueue(async () => {
                const library = await loadLibrary();
                const prompts = library.prompts.filter((prompt) => prompt.id !== request.payload.id);
                await saveLibrary({ ...library, prompts });
                return { response: ok(request.id, request.type, { deleted: true }) };
            });
        }
        case 'prompts:restoreDefaults': {
            return backgroundStorageQueue.enqueue(async () => {
                const library = await loadLibrary();
                const next = {
                    ...library,
                    seededComposerDefaults: true,
                    prompts: addMissingDefaultComposerPrompts(library.prompts),
                };
                await saveLibrary(next);
                return { response: ok(request.id, request.type, { prompts: next.prompts }) };
            });
        }
        case 'prompts:recordUse': {
            return backgroundStorageQueue.enqueue(async () => {
                const library = await loadLibrary();
                const usedAt = Number.isFinite(request.payload.usedAt) ? Number(request.payload.usedAt) : Date.now();
                const prompts = library.prompts.map((prompt) => (
                    prompt.id === request.payload.id
                        ? { ...prompt, lastUsedAt: usedAt, updatedAt: Math.max(prompt.updatedAt, usedAt) }
                        : prompt
                ));
                await saveLibrary({ ...library, prompts });
                return { response: ok(request.id, request.type, { recorded: true }) };
            });
        }
        default:
            return { response: err(request.id, request.type, 'UNKNOWN_TYPE', 'Unknown prompts request') };
    }
}
