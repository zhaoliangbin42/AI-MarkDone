import { beforeEach, describe, expect, it, vi } from 'vitest';

let responseData: unknown;
const sendExtRequestMock = vi.fn(async (request: any) => ({
    kind: 'response' as const,
    response: {
        v: request.v,
        id: request.id,
        type: request.type,
        ok: true as const,
        data: responseData,
    },
}));

vi.mock('../../../../src/drivers/shared/rpc', () => ({
    sendExtRequest: (request: any) => sendExtRequestMock(request),
}));

describe('PromptLibraryClient payload validation', () => {
    const prompt = {
        id: 'prompt-1',
        title: 'Rewrite',
        content: 'Rewrite this.',
        triggerText: 'rewrite',
        contexts: ['composer', 'readerComment'] as const,
        favorite: false,
        enabled: true,
        createdAt: 1,
        updatedAt: 2,
        lastUsedAt: null,
    };

    beforeEach(() => {
        responseData = undefined;
        sendExtRequestMock.mockClear();
    });

    it('rejects a successful prompts:list envelope whose prompts payload is missing', async () => {
        responseData = {};
        const { createPromptLibraryClient } = await import('../../../../src/drivers/content/prompts/promptLibraryClient');

        await expect(createPromptLibraryClient().listPrompts()).rejects.toMatchObject({
            name: 'RuntimeClientRequestError',
            failure: {
                kind: 'transport',
                code: 'INVALID_RESPONSE',
                delivery: 'unknown',
            },
        });
    });

    it('rejects malformed prompt records instead of returning them as a prompt list', async () => {
        responseData = { prompts: [{ id: 'incomplete-prompt' }] };
        const { createPromptLibraryClient } = await import('../../../../src/drivers/content/prompts/promptLibraryClient');

        await expect(createPromptLibraryClient().listPrompts()).rejects.toMatchObject({
            failure: { kind: 'transport', code: 'INVALID_RESPONSE' },
        });
    });

    it('rejects malformed success payloads for prompt mutations instead of committing empty state', async () => {
        responseData = {};
        const { createPromptLibraryClient } = await import('../../../../src/drivers/content/prompts/promptLibraryClient');
        const client = createPromptLibraryClient();

        await expect(client.savePrompt({ content: 'Rewrite this.' })).rejects.toMatchObject({
            failure: { kind: 'transport', code: 'INVALID_RESPONSE' },
        });
        await expect(client.deletePrompt('prompt-1')).rejects.toMatchObject({
            failure: { kind: 'transport', code: 'INVALID_RESPONSE' },
        });
        await expect(client.restoreDefaults()).rejects.toMatchObject({
            failure: { kind: 'transport', code: 'INVALID_RESPONSE' },
        });
        await expect(client.reorderPrompts(['prompt-1'])).rejects.toMatchObject({
            failure: { kind: 'transport', code: 'INVALID_RESPONSE' },
        });
        await expect(client.recordUse('prompt-1')).rejects.toMatchObject({
            failure: { kind: 'transport', code: 'INVALID_RESPONSE' },
        });
    });

    it('returns a structurally valid prompt list unchanged', async () => {
        responseData = { prompts: [prompt] };
        const { createPromptLibraryClient } = await import('../../../../src/drivers/content/prompts/promptLibraryClient');

        await expect(createPromptLibraryClient().listPrompts()).resolves.toEqual([prompt]);
    });
});
