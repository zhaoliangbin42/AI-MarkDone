import { describe, expect, it } from 'vitest';
import { buildRepairPlan } from '../../../../src/core/bookmarks/repair';

describe('bookmarks repair', () => {
    it('repairs partial records and quarantines irreparable records', () => {
        const now = Date.now();
        const rawStorage: Record<string, unknown> = {
            'bookmark:chatgpt.com/c/r1:1': {
                url: 'https://chatgpt.com/c/r1',
                position: 1,
                userMessage: 'u',
                timestamp: now,
            },
            'bookmark:chatgpt.com/c/r2:2': {
                url: 'https://chatgpt.com/c/r2',
                // missing position/userMessage/timestamp
            },
            'bookmark:bad:3': 'corrupted',
            'folder:Import': { path: 'Import' },
        };

        const plan = buildRepairPlan({ rawStorage, now });

        expect(plan.stats.examined).toBe(3);
        expect(plan.stats.repaired).toBe(2); // r1 + r2 become normalized records
        expect(plan.stats.removed).toBe(1);  // irreparable entry removed
        expect(plan.quarantine).toHaveLength(1);
        expect(plan.removeKeys).toEqual(['bookmark:bad:3']);
        expect(plan.setPatch['bookmark:chatgpt.com/c/r1:1']).toBeTruthy();
    });
});
