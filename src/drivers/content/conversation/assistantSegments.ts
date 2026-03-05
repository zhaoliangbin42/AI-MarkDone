import type { SiteAdapter } from '../adapters/base';

/**
 * Canonical enumeration of assistant "segments" for legacy position semantics.
 *
 * Important:
 * - Must preserve historical behavior used by bookmark `position` keys.
 * - Do NOT de-nest or filter nodes here; callers may apply additional rules for turn grouping.
 */
export function listAssistantSegmentElements(adapter: SiteAdapter): HTMLElement[] {
    const selector = adapter.getMessageSelector();
    return Array.from(document.querySelectorAll(selector)).filter((n): n is HTMLElement => n instanceof HTMLElement);
}

