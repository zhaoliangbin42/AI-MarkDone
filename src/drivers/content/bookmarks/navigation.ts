import type { SiteAdapter } from '../adapters/base';

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
        return { url: parsed.url, position: parsed.position };
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

export function scrollToAssistantPosition(adapter: SiteAdapter, position: number): ScrollResult {
    if (!Number.isFinite(position) || position <= 0) return { ok: false, message: 'Invalid position' };
    const selector = adapter.getMessageSelector();
    const messages = Array.from(document.querySelectorAll(selector)).filter((n): n is HTMLElement => n instanceof HTMLElement);
    const index = position - 1;
    if (index < 0 || index >= messages.length) return { ok: false, message: 'Position out of range' };
    const target = messages[index];
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => highlightElement(target), 100);
    return { ok: true };
}

export async function scrollToAssistantPositionWithRetry(
    adapter: SiteAdapter,
    position: number,
    options?: { timeoutMs?: number; intervalMs?: number }
): Promise<ScrollResult> {
    const timeoutMs = options?.timeoutMs ?? 2000;
    const intervalMs = options?.intervalMs ?? 200;
    const start = Date.now();
    let last: ScrollResult = { ok: false, message: 'Not ready' };
    while (Date.now() - start < timeoutMs) {
        last = scrollToAssistantPosition(adapter, position);
        if (last.ok) return last;
        await new Promise((r) => window.setTimeout(r, intervalMs));
    }
    return last;
}

