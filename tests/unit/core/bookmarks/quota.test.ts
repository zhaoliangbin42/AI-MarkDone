import { describe, expect, it } from 'vitest';
import type { Bookmark } from '../../../../src/core/bookmarks/types';
import { canImport, checkQuota } from '../../../../src/core/bookmarks/quota';

function seedBookmark(pos: number): Bookmark {
    return {
        url: `https://chatgpt.com/c/${pos}`,
        urlWithoutProtocol: `chatgpt.com/c/${pos}`,
        position: pos,
        userMessage: 'u'.repeat(20),
        aiResponse: 'a'.repeat(20),
        timestamp: 1,
        title: `t-${pos}`,
        platform: 'ChatGPT',
        folderPath: 'Import',
    };
}

describe('bookmarks quota', () => {
    it('returns warning at 95% and blocks at 98%', () => {
        const quotaBytes = 10_000;
        const warn = checkQuota({ usedBytes: 9500, quotaBytes });
        expect(warn.warningLevel).toBe('warning');
        expect(warn.canProceed).toBe(true);

        const critical = checkQuota({ usedBytes: 9800, quotaBytes });
        expect(critical.warningLevel).toBe('critical');
        expect(critical.canProceed).toBe(false);
    });

    it('canImport blocks when projected exceeds critical threshold', () => {
        const quotaBytes = 10_000;
        const result = canImport({
            currentUsedBytes: 9800,
            incomingBookmarks: [seedBookmark(1), seedBookmark(2), seedBookmark(3)],
            quotaBytes,
        });
        expect(result.canImport).toBe(false);
        expect(result.projectedPercentage).toBeGreaterThanOrEqual(98);
        expect(result.message).toContain('Import requires');
    });
});

