import type { ReaderItem } from '../../../services/reader/types';
import type { ReaderPanelProfile } from './ReaderPanelContracts';

export type ReaderScrollContainer = Pick<HTMLElement, 'clientHeight' | 'scrollHeight' | 'scrollTop'>;

function normalizeIdentityPart(value: string | null | undefined): string {
    return value?.trim() ?? '';
}

function clampProgress(progress: number): number {
    if (!Number.isFinite(progress)) return 0;
    return Math.max(0, Math.min(1, progress));
}

export function getReaderScrollPositionKey(item: ReaderItem, profile: ReaderPanelProfile): string {
    const stableIdentity = [
        item.meta?.assistantMessageId,
        item.meta?.messageId,
        item.meta?.roundId,
        item.meta?.branchKey,
        item.id,
    ].map(normalizeIdentityPart).find(Boolean) ?? 'unknown-item';
    const platform = normalizeIdentityPart(item.meta?.platformId) || 'unknown-platform';
    return `${profile}:${platform}:${stableIdentity}`;
}

export function readReaderScrollProgress(container: ReaderScrollContainer): number {
    const scrollableHeight = Math.max(0, container.scrollHeight - container.clientHeight);
    if (scrollableHeight <= 0) return 0;
    return clampProgress(container.scrollTop / scrollableHeight);
}

export function restoreReaderScrollProgress(
    container: ReaderScrollContainer,
    progress: number,
): boolean {
    const scrollableHeight = Math.max(0, container.scrollHeight - container.clientHeight);
    if (scrollableHeight <= 0) {
        container.scrollTop = 0;
        return false;
    }
    container.scrollTop = clampProgress(progress) * scrollableHeight;
    return true;
}
