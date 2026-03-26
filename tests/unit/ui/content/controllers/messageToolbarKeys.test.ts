import { describe, expect, it } from 'vitest';

import { resolveMessageKey, stripHash } from '@/ui/content/controllers/messageToolbarKeys';

describe('messageToolbarKeys', () => {
    it('strips URL hashes without changing origin, path, or query', () => {
        expect(stripHash('https://chat.openai.com/c/123?foo=bar#section')).toBe('https://chat.openai.com/c/123?foo=bar');
        expect(stripHash('/local/path#anchor')).toBe('/local/path');
    });

    it('builds a stable fallback key from the adapter turn contract when no message id exists', () => {
        const turnRoot = document.createElement('div');
        turnRoot.setAttribute('data-testid', 'conversation-turn-1');

        const message = document.createElement('article');
        turnRoot.appendChild(message);

        const adapter = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => '',
            getTurnRootElement: () => turnRoot,
            getMessageSelector: () => 'article',
        } as any;

        expect(resolveMessageKey(adapter, message, 8)).toBe('chatgpt:fallback:conversation-turn-1:8:0');
    });

    it('uses the provided segment index context instead of rescanning turn siblings', () => {
        const turnRoot = document.createElement('div');
        turnRoot.setAttribute('data-testid', 'conversation-turn-1');

        const message = document.createElement('article');
        turnRoot.appendChild(message);

        const querySpy = vi.spyOn(turnRoot, 'querySelectorAll');
        const segmentIndexByElement = new WeakMap<HTMLElement, number>();
        segmentIndexByElement.set(message, 3);

        const adapter = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => '',
            getTurnRootElement: () => turnRoot,
            getMessageSelector: () => 'article',
        } as any;

        expect(resolveMessageKey(adapter, message, 8, { segmentIndexByElement })).toBe('chatgpt:fallback:conversation-turn-1:8:3');
        expect(querySpy).not.toHaveBeenCalled();
    });
});
