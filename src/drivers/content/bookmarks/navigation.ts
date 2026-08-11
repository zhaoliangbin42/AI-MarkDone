import type { SiteAdapter } from '../adapters/base';
import {
    scrollToConversationTarget,
    scrollToConversationTargetWithRetry,
} from '../conversation/navigation';
import { highlightNavigationTarget } from '../conversation/highlight';
import { isChatGPTPageHostname } from '../../../contracts/chatgptHosts';

const NAV_KEY = 'aimd:bookmarkNavigate:v1';
export const PENDING_NAVIGATION_EVENT = 'aimd:pending-navigation';

function normalizeUrlForComparison(url: string, canonicalizeChatGPTHost: boolean): string {
    try {
        const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com');
        parsed.hash = '';
        parsed.search = '';
        if (canonicalizeChatGPTHost && isChatGPTPageHostname(parsed.hostname)) {
            parsed.protocol = 'https:';
            parsed.hostname = 'chatgpt.com';
            parsed.port = '';
        }
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return url
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')
            .replace(/#.*$/, '')
            .replace(/\?.*$/, '');
    }
}

function normalizeUrlForStorage(url: string, canonicalizeChatGPTHost: boolean): string {
    try {
        const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com');
        parsed.hash = '';
        if (canonicalizeChatGPTHost && isChatGPTPageHostname(parsed.hostname)) {
            parsed.protocol = 'https:';
            parsed.hostname = 'chatgpt.com';
            parsed.port = '';
        }
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return url.replace(/#.*$/, '').replace(/\/$/, '');
    }
}

/**
 * ChatGPT moved the public conversation host from chat.openai.com to
 * chatgpt.com. Treat that host change as the same page identity while
 * leaving the persisted bookmark URL untouched for compatibility.
 */
export function isSamePageUrl(a: string, b: string): boolean {
    return normalizeUrlForComparison(a, true) === normalizeUrlForComparison(b, true);
}

/** Return canonical and legacy URL forms used for read/remove compatibility. */
export function getBookmarkUrlCandidates(url: string): string[] {
    const canonical = normalizeUrlForComparison(url, true);
    const raw = normalizeUrlForComparison(url, false);
    const canonicalWithQuery = normalizeUrlForStorage(url, true);
    const rawWithQuery = normalizeUrlForStorage(url, false);
    let isChatGPTUrl = false;
    try {
        isChatGPTUrl = isChatGPTPageHostname(new URL(
            url,
            typeof window !== 'undefined' ? window.location.href : 'https://chatgpt.com',
        ).hostname);
    } catch {
        // Keep malformed/non-ChatGPT values on the legacy single-candidate path.
    }
    if (isChatGPTUrl) {
        const legacyHost = canonical.replace('://chatgpt.com', '://chat.openai.com');
        const legacyHostWithQuery = rawWithQuery.replace('://chatgpt.com', '://chat.openai.com');
        return Array.from(new Set([
            canonical,
            legacyHost,
            canonicalWithQuery,
            legacyHostWithQuery,
            raw,
            rawWithQuery,
        ]));
    }
    return Array.from(new Set([canonical, raw, rawWithQuery]));
}

export type PendingNavigation = {
    url: string;
    position: number;
    messageId?: string | null;
};

export function setPendingNavigation(nav: PendingNavigation): void {
    try {
        sessionStorage.setItem(NAV_KEY, JSON.stringify(nav));
        window.dispatchEvent(new Event(PENDING_NAVIGATION_EVENT));
    } catch {
        // ignore
    }
}

function readPendingNavigation(): PendingNavigation | null {
    try {
        const raw = sessionStorage.getItem(NAV_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as any;
        if (!parsed || typeof parsed.url !== 'string' || typeof parsed.position !== 'number') return null;
        if (parsed.position <= 0) return null;
        const messageId = typeof parsed.messageId === 'string' && parsed.messageId.trim().length > 0
            ? parsed.messageId
            : null;
        return { url: parsed.url, position: parsed.position, messageId };
    } catch {
        return null;
    }
}

/** Read a pending target without consuming it. SPA navigation may keep this runtime alive. */
export function peekPendingNavigation(): PendingNavigation | null {
    return readPendingNavigation();
}

export function clearPendingNavigation(): void {
    try {
        sessionStorage.removeItem(NAV_KEY);
    } catch {
        // ignore
    }
}

export function consumePendingNavigation(): PendingNavigation | null {
    const pending = readPendingNavigation();
    if (pending) clearPendingNavigation();
    return pending;
}

export type ScrollResult = { ok: true } | { ok: false; message: string };

export type BookmarkNavigationTarget = {
    position: number;
    messageId?: string | null;
};

function legacyScrollToAssistantPosition(
    adapter: SiteAdapter,
    position: number,
    options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): ScrollResult {
    if (!Number.isFinite(position) || position <= 0) return { ok: false, message: 'Invalid position' };
    const selector = adapter.getMessageSelector();
    const messages = Array.from(document.querySelectorAll(selector)).filter((n): n is HTMLElement => n instanceof HTMLElement);
    const index = position - 1;
    if (index < 0 || index >= messages.length) return { ok: false, message: 'Position out of range' };
    const target = messages[index];
    target.scrollIntoView({ behavior: options?.behavior ?? 'smooth', block: options?.block ?? 'center' });
    window.setTimeout(() => highlightNavigationTarget(target), 100);
    return { ok: true };
}

export function scrollToAssistantPosition(adapter: SiteAdapter, position: number): ScrollResult {
    if (adapter.getPlatformId?.() === 'chatgpt') {
        return { ok: false, message: 'Canonical async navigation required' };
    }
    const mapped = scrollToConversationTarget(adapter, { kind: 'legacyAssistantPosition', position });
    if (mapped.ok) return mapped;

    // Fallback for platforms where turn grouping is unavailable or DOM is in flux.
    return legacyScrollToAssistantPosition(adapter, position);
}

function normalizeMessageId(messageId?: string | null): string | null {
    if (typeof messageId !== 'string') return null;
    const trimmed = messageId.trim();
    return trimmed ? trimmed : null;
}

function buildBookmarkTargetLocators(target: BookmarkNavigationTarget): Array<{ kind: 'messageId'; messageId: string } | { kind: 'legacyAssistantPosition'; position: number }> {
    const locators: Array<{ kind: 'messageId'; messageId: string } | { kind: 'legacyAssistantPosition'; position: number }> = [];
    const messageId = normalizeMessageId(target.messageId);
    if (messageId) locators.push({ kind: 'messageId', messageId });
    if (Number.isFinite(target.position) && target.position > 0) {
        locators.push({ kind: 'legacyAssistantPosition', position: target.position });
    }
    return locators;
}

export function scrollToBookmarkTarget(adapter: SiteAdapter, target: BookmarkNavigationTarget): ScrollResult {
    const isChatGpt = adapter.getPlatformId?.() === 'chatgpt';
    if (isChatGpt) return { ok: false, message: 'Canonical async navigation required' };

    const locators = buildBookmarkTargetLocators(target);
    let last: ScrollResult = { ok: false, message: 'Position not available' };

    for (const locator of locators) {
        last = locator.kind === 'messageId'
            ? scrollToConversationTarget(adapter, locator)
            : scrollToAssistantPosition(adapter, locator.position);
        if (last.ok) return last;
    }

    return last;
}

export async function scrollToAssistantPositionWithRetry(
    adapter: SiteAdapter,
    position: number,
    options?: { timeoutMs?: number; intervalMs?: number; behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): Promise<ScrollResult> {
    if (adapter.getPlatformId?.() === 'chatgpt') {
        return { ok: false, message: 'Canonical navigation port required' };
    }

    const mapped = await scrollToConversationTargetWithRetry(adapter, { kind: 'legacyAssistantPosition', position }, options);
    if (mapped.ok) return mapped;
    const timeoutMs = options?.timeoutMs ?? 2000;
    const intervalMs = options?.intervalMs ?? 200;
    const start = Date.now();
    let last: ScrollResult = { ok: false, message: 'Not ready' };
    while (Date.now() - start < timeoutMs) {
        last = legacyScrollToAssistantPosition(adapter, position, {
            behavior: options?.behavior,
            block: options?.block,
        });
        if (last.ok) return last;
        await new Promise((r) => window.setTimeout(r, intervalMs));
    }
    return last;
}

export async function scrollToBookmarkTargetWithRetry(
    adapter: SiteAdapter,
    target: BookmarkNavigationTarget,
    options?: { timeoutMs?: number; intervalMs?: number; behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): Promise<ScrollResult> {
    const isChatGpt = adapter.getPlatformId?.() === 'chatgpt';
    const navOptions = {
        ...options,
        block: options?.block ?? ('start' as ScrollLogicalPosition),
    };
    if (isChatGpt) {
        return { ok: false, message: 'Canonical navigation port required' };
    }

    const locators = buildBookmarkTargetLocators(target);
    let last: ScrollResult = { ok: false, message: 'Position not available' };

    for (const locator of locators) {
        last = locator.kind === 'messageId'
            ? await scrollToConversationTargetWithRetry(adapter, locator, navOptions)
            : await scrollToAssistantPositionWithRetry(adapter, locator.position, navOptions);
        if (last.ok) return last;
    }

    return last;
}
