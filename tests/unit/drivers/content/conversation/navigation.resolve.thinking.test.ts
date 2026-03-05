import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { listAssistantSegmentElements } from '@/drivers/content/conversation/assistantSegments';
import { resolveConversationTarget } from '@/drivers/content/conversation/navigation';

describe('resolveConversationTarget (ChatGPT Thinking)', () => {
    it(
        'maps legacy assistant segment positions to the owning turn primary message (正文)',
        () => {
            const html = readFileSync('mocks/ChatGPT/ChatGPT-Thinking.html', 'utf-8');
            document.documentElement.innerHTML = `<head></head><body>${html}</body>`;

            const adapter = new ChatGPTAdapter();
            const segments = listAssistantSegmentElements(adapter);

            const res1 = resolveConversationTarget(adapter, { kind: 'legacyAssistantPosition', position: 1 });
            expect(res1.ok).toBe(true);
            if (!res1.ok) return;

            const seg1 = segments[0]!;
            const seg1Turn = adapter.getTurnRootElement?.(seg1) ?? seg1.closest?.('[data-testid^="conversation-turn-"]');
            const target1Turn = adapter.getTurnRootElement?.(res1.targetEl) ?? res1.targetEl.closest?.('[data-testid^="conversation-turn-"]');
            expect(seg1Turn).toBeTruthy();
            expect(target1Turn).toBeTruthy();
            expect(seg1Turn).toBe(target1Turn);

            // The first assistant "turn" in the fixture contains a short preface + a longer body.
            // We should land on the primary (last) segment (正文), not the preface segment.
            expect(res1.targetEl.getAttribute('data-message-id')).toBe('49d143ca-8c00-449f-81c6-0f9bf4960dff');
            expect(res1.targetEl.textContent || '').toContain('Benko，你说的这个功能');
            expect(res1.targetEl.textContent || '').not.toContain('我会先查苹果官方的用户指南');

            const res2 = resolveConversationTarget(adapter, { kind: 'legacyAssistantPosition', position: 2 });
            expect(res2.ok).toBe(true);
            if (!res2.ok) return;
            expect(res2.targetEl.getAttribute('data-message-id')).toBe('49d143ca-8c00-449f-81c6-0f9bf4960dff');

            const seg2 = segments[1]!;
            const seg2Turn = adapter.getTurnRootElement?.(seg2) ?? seg2.closest?.('[data-testid^="conversation-turn-"]');
            const target2Turn = adapter.getTurnRootElement?.(res2.targetEl) ?? res2.targetEl.closest?.('[data-testid^="conversation-turn-"]');
            expect(seg2Turn).toBeTruthy();
            expect(target2Turn).toBeTruthy();
            expect(seg2Turn).toBe(target2Turn);
        },
        20_000
    );
});
