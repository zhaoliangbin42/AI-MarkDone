import { describe, expect, it } from 'vitest';
import { computeMountedConversationGroups } from '@/drivers/content/virtualization/conversationWindow';

describe('computeMountedConversationGroups', () => {
    it('preserves viewport, overscan, recent assistant, streaming, and focused groups', () => {
        const mounted = computeMountedConversationGroups({
            groups: [
                { id: 'g1', top: 0, bottom: 200, assistantIndex: 0, heavy: false, streaming: false, hasFocus: false },
                { id: 'g2', top: 2200, bottom: 2600, assistantIndex: 1, heavy: true, streaming: false, hasFocus: false },
                { id: 'g3', top: 3200, bottom: 3600, assistantIndex: 2, heavy: false, streaming: true, hasFocus: false },
                { id: 'g4', top: 5200, bottom: 5600, assistantIndex: 3, heavy: false, streaming: false, hasFocus: true },
                { id: 'g5', top: 6200, bottom: 6600, assistantIndex: 4, heavy: false, streaming: false, hasFocus: false },
            ],
            viewportTop: 2000,
            viewportBottom: 3000,
            overscanPx: 400,
            preserveRecentAssistantCount: 2,
        });

        expect(mounted).toEqual(new Set(['g2', 'g3', 'g4', 'g5']));
    });
});
