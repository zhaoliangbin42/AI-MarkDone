import type { SiteAdapter } from '../adapters/base';
import { listAssistantSegmentElements } from '../conversation/assistantSegments';

export function getConversationUrl(): string {
    return window.location.href;
}

export function getAssistantPosition(adapter: SiteAdapter, messageElement: HTMLElement): number {
    const all = listAssistantSegmentElements(adapter);
    const index = all.indexOf(messageElement);
    return index === -1 ? -1 : index + 1;
}
