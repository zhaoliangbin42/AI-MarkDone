import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { highlightElement, scrollToBookmarkTargetWithRetry, type ScrollResult } from '../../../drivers/content/bookmarks/navigation';

export type ChatGPTSkeletonAnchor = {
    position: number;
    anchorEl: HTMLElement;
};

export type ChatGPTNavigationTarget = {
    position: number;
    messageId?: string | null;
};

export function collectChatGPTSkeletonAnchors(adapter: SiteAdapter): ChatGPTSkeletonAnchor[] {
    const turnContainers = Array.from(document.querySelectorAll('[data-turn-id-container]')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
    );
    const anchors: ChatGPTSkeletonAnchor[] = [];
    let pendingUserContainer: HTMLElement | null = null;

    for (const container of turnContainers) {
        const userTurn = container.querySelector('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]');
        const assistantTurn = container.querySelector('section[data-turn="assistant"], article[data-turn="assistant"], [data-turn="assistant"]');

        if (userTurn instanceof HTMLElement && !(assistantTurn instanceof HTMLElement)) {
            pendingUserContainer = container;
            continue;
        }

        if (!(assistantTurn instanceof HTMLElement)) continue;
        anchors.push({
            position: anchors.length + 1,
            anchorEl: pendingUserContainer ?? container,
        });
        pendingUserContainer = null;
    }

    if (anchors.length > 0) return anchors;

    const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
    );
    messages.forEach((messageEl, index) => {
        anchors.push({
            position: index + 1,
            anchorEl: messageEl,
        });
    });
    return anchors;
}

export function resolveChatGPTSkeletonPositionForMessage(adapter: SiteAdapter, messageElement: HTMLElement): number | null {
    const turnContainers = Array.from(document.querySelectorAll('[data-turn-id-container]')).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
    );
    let position = 0;

    for (const container of turnContainers) {
        const userTurn = container.querySelector('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]');
        const assistantTurn = container.querySelector('section[data-turn="assistant"], article[data-turn="assistant"], [data-turn="assistant"]');

        if (userTurn instanceof HTMLElement && !(assistantTurn instanceof HTMLElement)) {
            continue;
        }

        if (!(assistantTurn instanceof HTMLElement)) continue;
        position += 1;
        if (container.contains(messageElement) || assistantTurn.contains(messageElement)) {
            return position;
        }
    }

    const messages = Array.from(document.querySelectorAll(adapter.getMessageSelector())).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
    );
    const index = messages.findIndex((node) => node === messageElement || node.contains(messageElement) || messageElement.contains(node));
    return index >= 0 ? index + 1 : null;
}

export async function navigateChatGPTDirectoryTarget(
    adapter: SiteAdapter,
    target: ChatGPTNavigationTarget,
    options?: { timeoutMs?: number; intervalMs?: number }
): Promise<ScrollResult> {
    const anchor = collectChatGPTSkeletonAnchors(adapter)[target.position - 1]?.anchorEl;
    if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ behavior: 'auto', block: 'start' });
        window.setTimeout(() => highlightElement(anchor), 40);
        return { ok: true };
    }

    return scrollToBookmarkTargetWithRetry(
        adapter,
        { position: target.position, messageId: target.messageId },
        {
            timeoutMs: options?.timeoutMs ?? 1500,
            intervalMs: options?.intervalMs ?? 120,
        },
    );
}
