import type { SiteAdapter } from '../../../drivers/content/adapters/base';

function toStructuralToken(element: HTMLElement | null | undefined): string {
    if (!element) return 'none';
    const parts = [
        element.id,
        element.getAttribute('data-testid'),
        element.getAttribute('data-message-id'),
        element.getAttribute('data-turn'),
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return parts[0] || element.tagName.toLowerCase();
}

export function stripHash(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
        return url.split('#')[0] || url;
    }
}

export function resolveMessageKey(adapter: SiteAdapter, messageElement: HTMLElement, position: number): string {
    const platformId = adapter.getPlatformId();
    try {
        const raw = adapter.getMessageId(messageElement)?.trim();
        if (raw) return `${platformId}:id:${raw}`;
    } catch {
        // fall through to structural key
    }

    const turnRoot = adapter.getTurnRootElement?.(messageElement) ?? null;
    const turnToken = toStructuralToken(turnRoot instanceof HTMLElement ? turnRoot : null);
    const selector = adapter.getMessageSelector();
    const assistantSiblings = turnRoot
        ? Array.from(turnRoot.querySelectorAll(selector)).filter((node): node is HTMLElement => node instanceof HTMLElement)
        : [];
    const segmentIndex = assistantSiblings.indexOf(messageElement);
    return `${platformId}:fallback:${turnToken}:${position}:${segmentIndex >= 0 ? segmentIndex : 0}`;
}
