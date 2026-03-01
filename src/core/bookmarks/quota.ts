import type { Bookmark, QuotaCheckResult } from './types';
import { buildBookmarkStorageKey } from './keys';

export const BOOKMARKS_QUOTA_THRESHOLDS = {
    warning: 0.95,
    critical: 0.98,
} as const;

export function estimateBookmarkBytes(bookmark: Bookmark): number {
    const key = buildBookmarkStorageKey(bookmark.url, bookmark.position);
    const keySize = key.length;
    const valueSize = JSON.stringify(bookmark).length;
    return keySize + valueSize;
}

export function estimateBookmarksBytes(bookmarks: Bookmark[]): number {
    return bookmarks.reduce((sum, b) => sum + estimateBookmarkBytes(b), 0);
}

export function checkQuota(params: {
    usedBytes: number;
    quotaBytes: number;
    warningThreshold?: number;
    criticalThreshold?: number;
}): QuotaCheckResult {
    const warningThreshold = params.warningThreshold ?? BOOKMARKS_QUOTA_THRESHOLDS.warning;
    const criticalThreshold = params.criticalThreshold ?? BOOKMARKS_QUOTA_THRESHOLDS.critical;

    const quotaBytes = Math.max(1, params.quotaBytes);
    const usedPercentage = (params.usedBytes / quotaBytes) * 100;

    if (usedPercentage >= criticalThreshold * 100) {
        return {
            canProceed: false,
            warningLevel: 'critical',
            usedPercentage,
            message: `Storage is ${usedPercentage.toFixed(1)}% full.`,
        };
    }

    if (usedPercentage >= warningThreshold * 100) {
        return {
            canProceed: true,
            warningLevel: 'warning',
            usedPercentage,
            message: `Storage is ${usedPercentage.toFixed(1)}% full.`,
        };
    }

    return { canProceed: true, warningLevel: 'none', usedPercentage };
}

export function canImport(params: {
    currentUsedBytes: number;
    incomingBookmarks: Bookmark[];
    quotaBytes: number;
    criticalThreshold?: number;
}): {
    canImport: boolean;
    estimatedBytes: number;
    currentUsed: number;
    projectedPercentage: number;
    message?: string;
} {
    const criticalThreshold = params.criticalThreshold ?? BOOKMARKS_QUOTA_THRESHOLDS.critical;
    const estimatedBytes = estimateBookmarksBytes(params.incomingBookmarks);
    const projectedUsed = params.currentUsedBytes + estimatedBytes;
    const projectedPercentage = (projectedUsed / Math.max(1, params.quotaBytes)) * 100;

    if (projectedPercentage >= criticalThreshold * 100) {
        const estimatedKB = (estimatedBytes / 1024).toFixed(1);
        const availableKB = ((params.quotaBytes * criticalThreshold - params.currentUsedBytes) / 1024).toFixed(1);
        return {
            canImport: false,
            estimatedBytes,
            currentUsed: params.currentUsedBytes,
            projectedPercentage,
            message: `Import requires ~${estimatedKB}KB but only ${availableKB}KB available.`,
        };
    }

    return { canImport: true, estimatedBytes, currentUsed: params.currentUsedBytes, projectedPercentage };
}

