export const CHATGPT_OFFICIAL_NAV_ROOT_SELECTOR = [
    `main [class$="_convSearchResultHighlightRoot"]`,
    `main [class*="_convSearchResultHighlightRoot "]`,
].join(',');

export const CHATGPT_OFFICIAL_NAV_FIXED_CHILD_SELECTOR = [
    'fixed',
    'inset-e-4',
    'top-1/2',
    'z-20',
    '-translate-y-1/2',
];

export const CHATGPT_OFFICIAL_NAV_FIXED_CHILD_CSS_SELECTOR = CHATGPT_OFFICIAL_NAV_FIXED_CHILD_SELECTOR
    .map((token) => `[class~="${token}"]`)
    .join('');

export type ChatGPTOfficialNavigationSnapshot = Readonly<{
    ready: boolean;
    expectedTurnCount: number;
}>;

function isOfficialFixedChild(element: Element): element is HTMLElement {
    return element instanceof HTMLElement
        && CHATGPT_OFFICIAL_NAV_FIXED_CHILD_SELECTOR.every((token) => element.classList.contains(token))
        && !element.closest('[data-aimd-role]');
}

/** Read the host-owned full-conversation navigation skeleton without labels. */
export function readChatGPTOfficialNavigation(): ChatGPTOfficialNavigationSnapshot {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(CHATGPT_OFFICIAL_NAV_ROOT_SELECTOR));
    for (const root of roots) {
        const fixedChild = Array.from(root.children).find(isOfficialFixedChild);
        if (!fixedChild) continue;
        const expectedTurnCount = fixedChild.querySelectorAll('button').length;
        if (expectedTurnCount > 0) {
            return Object.freeze({ ready: true, expectedTurnCount });
        }
    }
    return Object.freeze({ ready: false, expectedTurnCount: 0 });
}
