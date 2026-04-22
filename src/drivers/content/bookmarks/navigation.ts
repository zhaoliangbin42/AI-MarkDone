import type { SiteAdapter } from '../adapters/base';
import {
    highlightElement as highlightConversationElement,
    resolveConversationTarget,
    scrollToConversationTarget,
    scrollToConversationTargetWithRetry,
    type ConversationLocator,
} from '../conversation/navigation';

const NAV_KEY = 'aimd:bookmarkNavigate:v1';

function normalizePageUrl(url: string): string {
    return url
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/#.*$/, '')
        .replace(/\?.*$/, '');
}

export type PendingNavigation = {
    url: string;
    position: number;
    messageId?: string | null;
};

export function setPendingNavigation(nav: PendingNavigation): void {
    try {
        sessionStorage.setItem(NAV_KEY, JSON.stringify(nav));
    } catch {
        // ignore
    }
}

export function consumePendingNavigation(): PendingNavigation | null {
    try {
        const raw = sessionStorage.getItem(NAV_KEY);
        sessionStorage.removeItem(NAV_KEY);
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

export function isSamePageUrl(a: string, b: string): boolean {
    return normalizePageUrl(a) === normalizePageUrl(b);
}

export function highlightElement(element: HTMLElement): void {
    element.dataset.aimdHighlight = '1';
    element.style.outline = '2px solid var(--aimd-interactive-primary)';
    element.style.outlineOffset = '2px';
    window.setTimeout(() => {
        if (element.dataset.aimdHighlight !== '1') return;
        delete element.dataset.aimdHighlight;
        element.style.outline = '';
        element.style.outlineOffset = '';
    }, 3000);
}

export type ScrollResult = { ok: true } | { ok: false; message: string };

export type BookmarkNavigationTarget = {
    position: number;
    messageId?: string | null;
};

type ChatGptFoldNavigationHint = {
    scrollTarget: HTMLElement;
    highlightTarget: HTMLElement;
    foldBarEl: HTMLElement | null;
    ready: boolean;
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
    window.setTimeout(() => highlightElement(target), 100);
    return { ok: true };
}

export function scrollToAssistantPosition(adapter: SiteAdapter, position: number): ScrollResult {
    const mapped = scrollToConversationTarget(adapter, { kind: 'legacyAssistantPosition', position });
    if (mapped.ok) return mapped;

    // Fallback for platforms where turn grouping is unavailable or DOM is in flux.
    // Keeps legacy behavior as a safety net.
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

function findChatGptFoldBar(groupId: string): HTMLElement | null {
    for (const element of document.querySelectorAll('.aimd-chatgpt-foldbar')) {
        if (!(element instanceof HTMLElement)) continue;
        if (element.getAttribute('data-aimd-fold-group-id') === groupId) return element;
    }
    return null;
}

function requestChatGptFoldBarAttention(barEl: HTMLElement, durationMs = 3000): void {
    barEl.dispatchEvent(new CustomEvent('aimd:flash-attention', {
        detail: { durationMs },
        bubbles: false,
        composed: false,
    }));
}

function resolveChatGptFoldNavigationHint(targetEl: HTMLElement): ChatGptFoldNavigationHint | null {
    const assistantRoot = targetEl.closest<HTMLElement>('[data-aimd-fold-role="assistant"][data-aimd-fold-group-id]');
    if (!assistantRoot) return null;
    const groupId = assistantRoot.getAttribute('data-aimd-fold-group-id');
    if (!groupId) return null;
    const foldBarEl = findChatGptFoldBar(groupId);
    const folded = assistantRoot.getAttribute('data-aimd-folded') === '1';
    return {
        scrollTarget: folded && foldBarEl ? foldBarEl : targetEl,
        highlightTarget: targetEl,
        foldBarEl,
        ready: !folded || Boolean(foldBarEl),
    };
}

function scrollElementIntoView(targetEl: HTMLElement, options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition }): ScrollResult {
    if (typeof targetEl.scrollIntoView !== 'function') return { ok: false, message: 'Scroll target unavailable' };
    targetEl.scrollIntoView({ behavior: options?.behavior ?? 'smooth', block: options?.block ?? 'center' });
    window.setTimeout(() => highlightElement(targetEl), 100);
    return { ok: true };
}

function scrollChatGptLocator(
    adapter: SiteAdapter,
    locator: ConversationLocator,
    options?: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): ScrollResult {
    const resolved = resolveConversationTarget(adapter, locator);
    if (!resolved.ok) return resolved;
    const hint = resolveChatGptFoldNavigationHint(resolved.targetEl);
    if (!hint) return scrollElementIntoView(resolved.targetEl, options);
    if (!hint.ready) return { ok: false, message: 'Fold target not ready' };
    if (typeof hint.scrollTarget.scrollIntoView !== 'function') return { ok: false, message: 'Scroll target unavailable' };
    hint.scrollTarget.scrollIntoView({ behavior: options?.behavior ?? 'smooth', block: options?.block ?? 'center' });
    window.setTimeout(() => {
        highlightConversationElement(hint.highlightTarget);
        if (hint.foldBarEl) requestChatGptFoldBarAttention(hint.foldBarEl);
    }, 100);
    return { ok: true };
}

async function scrollChatGptLocatorWithRetry(
    adapter: SiteAdapter,
    locator: ConversationLocator,
    options?: { timeoutMs?: number; intervalMs?: number; behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): Promise<ScrollResult> {
    const timeoutMs = options?.timeoutMs ?? 2000;
    const intervalMs = options?.intervalMs ?? 200;
    const start = Date.now();
    let last: ScrollResult = { ok: false, message: 'Not ready' };
    while (Date.now() - start < timeoutMs) {
        last = scrollChatGptLocator(adapter, locator, {
            behavior: options?.behavior,
            block: options?.block,
        });
        if (last.ok) return last;
        await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
    return last;
}

export function scrollToBookmarkTarget(adapter: SiteAdapter, target: BookmarkNavigationTarget): ScrollResult {
    const locators = buildBookmarkTargetLocators(target);
    let last: ScrollResult = { ok: false, message: 'Position not available' };
    const isChatGpt = adapter.getPlatformId?.() === 'chatgpt';

    for (const locator of locators) {
        last = isChatGpt
            ? scrollChatGptLocator(adapter, locator)
            : (locator.kind === 'messageId' ? scrollToConversationTarget(adapter, locator) : scrollToAssistantPosition(adapter, locator.position));
        if (last.ok) return last;
    }

    return last;
}

export async function scrollToAssistantPositionWithRetry(
    adapter: SiteAdapter,
    position: number,
    options?: { timeoutMs?: number; intervalMs?: number; behavior?: ScrollBehavior; block?: ScrollLogicalPosition }
): Promise<ScrollResult> {
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
    const locators = buildBookmarkTargetLocators(target);
    let last: ScrollResult = { ok: false, message: 'Position not available' };
    const isChatGpt = adapter.getPlatformId?.() === 'chatgpt';
    const navOptions = {
        ...options,
        block: options?.block ?? ('start' as ScrollLogicalPosition),
    };

    for (const locator of locators) {
        last = isChatGpt
            ? await scrollChatGptLocatorWithRetry(adapter, locator, navOptions)
            : (locator.kind === 'messageId'
                ? await scrollToConversationTargetWithRetry(adapter, locator, navOptions)
                : await scrollToAssistantPositionWithRetry(adapter, locator.position, navOptions));
        if (last.ok) return last;
    }

    return last;
}
