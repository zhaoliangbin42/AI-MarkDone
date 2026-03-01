import type { SiteAdapter } from '../adapters/base';

export function getConversationUrl(): string {
    return window.location.href;
}

export function getAssistantPosition(adapter: SiteAdapter, messageElement: HTMLElement): number {
    const selector = adapter.getMessageSelector();
    const all = Array.from(document.querySelectorAll(selector)).filter((n): n is HTMLElement => n instanceof HTMLElement);
    const index = all.indexOf(messageElement);
    return index === -1 ? -1 : index + 1;
}

