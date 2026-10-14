import { afterEach, describe, expect, it, vi } from 'vitest';
import { showConversationNavigationFailure } from '@/ui/content/components/conversationNavigationFeedback';

vi.mock('@/ui/content/components/i18n', () => ({
    t: (key: string) => ({
        conversationNavigationFailed: 'Could not locate this message on the page.',
        conversationNavigationOpenMessage: 'Open message in new tab',
        btnClose: 'Close',
    }[key] ?? key),
}));

describe('showConversationNavigationFailure', () => {
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.replaceChildren();
        document.getElementById('aimd-shared-toast-style')?.remove();
    });

    it.each(['slot-missing', 'hydration-timeout', 'source-unavailable'] as const)(
        'offers an explicit message link after %s through the actual trigger event order',
        (reason) => {
            vi.useFakeTimers();
            const open = vi.spyOn(window, 'open');
            const trigger = document.createElement('button');
            trigger.addEventListener('click', () => showConversationNavigationFailure(
                { ok: false, reason },
                'https://chatgpt.com/g/project/c/conversation?message=old#old',
                'assistant-message',
            ));
            document.body.appendChild(trigger);
            trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
            trigger.click();

            const link = document.querySelector<HTMLAnchorElement>('.aimd-toast a');
            expect(document.querySelector('.aimd-toast')?.textContent).toContain('Could not locate this message on the page.');
            expect(link?.textContent).toBe('Open message in new tab');
            expect(link?.href).toBe('https://chatgpt.com/g/project/c/conversation?messageId=assistant-message');
            expect(link?.target).toBe('_blank');
            expect(link?.rel).toBe('noopener noreferrer');
            expect(open).not.toHaveBeenCalled();
            vi.advanceTimersByTime(60_000);
            expect(link?.isConnected).toBe(true);
            link?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
            expect(link?.isConnected).toBe(true);
            link?.click();
            expect(document.querySelector('.aimd-toast')).toBeNull();
        },
    );

    it.each(['cancelled', 'stale-target'] as const)('keeps %s silent', (reason) => {
        showConversationNavigationFailure({ ok: false, reason }, 'https://chatgpt.com/c/conversation', 'assistant-id');
        expect(document.querySelector('.aimd-toast')).toBeNull();
    });

    it('does not guess a message link after an identity conflict', () => {
        showConversationNavigationFailure(
            { ok: false, reason: 'identity-conflict' },
            'https://chatgpt.com/c/conversation',
            'assistant-id',
        );
        expect(document.querySelector('.aimd-toast')?.textContent).toBe('Could not locate this message on the page.');
        expect(document.querySelector('.aimd-toast a')).toBeNull();
    });

    it.each([
        ['https://example.com/c/conversation', 'assistant-id'],
        ['https://chatgpt.com/c/conversation', null],
        ['https://chatgpt.com/c/conversation', 'fallback-turn-1'],
    ])('does not offer an unreliable message URL for %s and %s', (url, assistantMessageId) => {
        showConversationNavigationFailure({ ok: false, reason: 'slot-missing' }, url!, assistantMessageId);
        expect(document.querySelector('.aimd-toast')?.textContent).toBe('Could not locate this message on the page.');
        expect(document.querySelector('.aimd-toast a')).toBeNull();
    });

    it('does not show feedback for successful navigation', () => {
        showConversationNavigationFailure({
            ok: true,
            phase: 'hydrated',
            resolvedBy: 'identity',
            target: {
                documentKey: 'chatgpt:conversation',
                position: 1,
                roundId: 'round-id',
                userMessageId: 'user-id',
                assistantMessageId: 'assistant-id',
            },
        }, 'https://chatgpt.com/c/conversation', 'assistant-id');
        expect(document.querySelector('.aimd-toast')).toBeNull();
    });
});
