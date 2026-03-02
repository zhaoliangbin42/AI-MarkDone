import { describe, expect, it } from 'vitest';
import { computeCollapsedGroupIndices } from '@/core/chatgptFolding/policy';

describe('chatgpt folding policy', () => {
    it('collapses none when off', () => {
        expect(Array.from(computeCollapsedGroupIndices('off', 8, 10))).toEqual([]);
    });

    it('collapses all when all', () => {
        expect(Array.from(computeCollapsedGroupIndices('all', 8, 3))).toEqual([0, 1, 2]);
    });

    it('collapses all when keep_last_n=0', () => {
        expect(Array.from(computeCollapsedGroupIndices('keep_last_n', 0, 3))).toEqual([0, 1, 2]);
    });

    it('keeps last N expanded in keep_last_n', () => {
        expect(Array.from(computeCollapsedGroupIndices('keep_last_n', 2, 5))).toEqual([0, 1, 2]);
        expect(Array.from(computeCollapsedGroupIndices('keep_last_n', 8, 5))).toEqual([]);
    });
});

