import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveMessagesAsMarkdown, type ChatTurn, type ConversationMetadata } from '../save-messages';

describe('saveMessagesAsMarkdown', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should no-op when no selected messages', async () => {
        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

        await saveMessagesAsMarkdown([], [], {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'Conversation',
            count: 0,
            platform: 'ChatGPT'
        });

        expect(createObjectURLSpy).not.toHaveBeenCalled();
        expect(document.body.querySelector('a')).toBeNull();
    });

    it('should sanitize filename and trigger download', async () => {
        const messages: ChatTurn[] = [
            { user: 'u1', assistant: 'a1', index: 0 }
        ];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'A/B:C* D?',
            count: 1,
            platform: 'ChatGPT'
        };

        const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        await saveMessagesAsMarkdown(messages, [0], metadata);

        expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');
        expect(clickSpy).toHaveBeenCalledTimes(1);

        const appendedAnchor = appendSpy.mock.calls
            .map(call => call[0])
            .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);

        expect(appendedAnchor).toBeDefined();
        expect(appendedAnchor?.download).toBe('A_B_C__D_.md');
    });

    it('should truncate very long filename to max length before extension', async () => {
        const messages: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: 'x'.repeat(150),
            count: 1,
            platform: 'ChatGPT'
        };

        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        await saveMessagesAsMarkdown(messages, [0], metadata);

        const anchor = appendSpy.mock.calls
            .map(call => call[0])
            .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);

        expect(anchor).toBeDefined();
        expect(anchor?.download.endsWith('.md')).toBe(true);
        expect((anchor?.download || '').replace(/\.md$/, '').length).toBeLessThanOrEqual(100);
    });

    it('should normalize markdown title heading to a single safe line', async () => {
        const messages: ChatTurn[] = [{ user: 'u1', assistant: 'a1', index: 0 }];
        const metadata: ConversationMetadata = {
            url: 'https://chatgpt.com',
            exportedAt: new Date().toISOString(),
            title: '### Line1\nLine2',
            count: 1,
            platform: 'ChatGPT'
        };

        const blobSpy = vi.spyOn(globalThis, 'Blob');
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => { });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });

        await saveMessagesAsMarkdown(messages, [0], metadata);

        const blobArg = blobSpy.mock.calls[0]?.[0]?.[0];
        expect(typeof blobArg).toBe('string');
        expect(blobArg).toContain('# Line1 Line2');
        expect(blobArg).not.toContain('# ### Line1');
    });
});
