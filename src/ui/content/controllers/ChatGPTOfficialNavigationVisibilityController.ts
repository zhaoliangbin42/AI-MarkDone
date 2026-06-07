const HIDDEN_ATTR = 'data-aimd-official-conversation-nav-hidden';
const STYLE_ID = 'aimd-official-conversation-nav-visibility-style';
const REFRESH_DELAY_MS = 250;
const OFFICIAL_NAV_ROOT_CLASS_SUFFIX = '_convSearchResultHighlightRoot';
const OFFICIAL_NAV_ROOT_SELECTOR = 'main [class*="_convSearchResultHighlightRoot"]';
const OFFICIAL_NAV_FIXED_CHILD_SELECTOR = `${OFFICIAL_NAV_ROOT_SELECTOR} > [class~="fixed"][class~="inset-e-4"][class~="top-1/2"][class~="z-20"][class~="-translate-y-1/2"]`;
const OFFICIAL_NAV_FIXED_CHILD_CLASS_TOKENS = new Set(['fixed', 'inset-e-4', 'top-1/2', 'z-20', '-translate-y-1/2']);

function getElementClassName(element: Element): string {
    return typeof element.className === 'string'
        ? element.className
        : String(element.getAttribute('class') || '');
}

function isExcludedHostNavigation(element: Element): boolean {
    return Boolean(element.closest([
        '#stage-sidebar-tiny-bar',
        '#stage-slideover-sidebar',
        'nav[aria-label="侧边栏"]',
        'nav[aria-label="历史聊天记录"]',
        'nav[aria-label="Sidebar"]',
        'nav[aria-label="Chat history"]',
        '[data-testid^="history-item-"]',
    ].join(',')));
}

function hasClassTokenEndingWith(element: Element, suffix: string): boolean {
    return getElementClassName(element)
        .split(/\s+/)
        .some((token) => token.endsWith(suffix));
}

function isExtensionOwnedNode(element: Element): boolean {
    return Boolean(element.closest('[data-aimd-role], #aimd-chatgpt-directory-rail, .aimd-message-toolbar-host'));
}

function hasAllOfficialFixedChildClassTokens(element: Element): boolean {
    const tokens = new Set(getElementClassName(element).split(/\s+/).filter(Boolean));
    for (const token of OFFICIAL_NAV_FIXED_CHILD_CLASS_TOKENS) {
        if (!tokens.has(token)) return false;
    }
    return true;
}

function isOfficialRightFixedChild(element: Element): element is HTMLElement {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.isConnected) return false;
    if (isExcludedHostNavigation(element)) return false;
    if (isExtensionOwnedNode(element)) return false;
    if (hasAllOfficialFixedChildClassTokens(element)) return true;

    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    if (rect.width <= 0 || rect.height <= 0 || viewportWidth <= 0) return false;

    const style = window.getComputedStyle(element);
    return style.position === 'fixed'
        && rect.width >= 16
        && rect.width <= 140
        && rect.height >= 50
        && viewportWidth - rect.right <= 80;
}

function collectOfficialConversationNavigationCandidates(): { candidates: HTMLElement[]; rootCount: number } {
    const roots = Array.from(document.querySelectorAll('[class]'))
        .filter((element): element is HTMLElement => (
            element instanceof HTMLElement
            && element.isConnected
            && hasClassTokenEndingWith(element, OFFICIAL_NAV_ROOT_CLASS_SUFFIX)
            && !isExcludedHostNavigation(element)
            && !isExtensionOwnedNode(element)
        ));

    return {
        candidates: roots.flatMap((root) => Array.from(root.children).filter(isOfficialRightFixedChild)),
        rootCount: roots.length,
    };
}

export class ChatGPTOfficialNavigationVisibilityController {
    private enabled = false;
    private observer: MutationObserver | null = null;
    private refreshTimer: number | null = null;
    private hiddenElements = new Set<HTMLElement>();

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) {
            if (enabled) this.scheduleRefresh();
            return;
        }
        this.enabled = enabled;
        if (enabled) {
            this.ensureStyle();
            this.bindObserver();
            this.refresh();
        } else {
            this.unbindObserver();
            this.clearHiddenElements();
            this.removeStyle();
        }
    }

    dispose(): void {
        this.enabled = false;
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.unbindObserver();
        this.clearHiddenElements();
        this.removeStyle();
    }

    private bindObserver(): void {
        if (this.observer) return;
        this.observer = new MutationObserver((mutations) => {
            if (!this.enabled) return;
            const relevant = mutations.some((mutation) => (
                mutation.type === 'attributes'
                || mutation.addedNodes.length > 0
                || mutation.removedNodes.length > 0
            ));
            if (!relevant) return;
            this.scheduleRefresh();
        });
        this.observer.observe(document.body || document.documentElement, {
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
            attributes: true,
            childList: true,
            subtree: true,
        });
    }

    private unbindObserver(): void {
        this.observer?.disconnect();
        this.observer = null;
    }

    private scheduleRefresh(): void {
        if (this.refreshTimer !== null) return;
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            this.refresh();
        }, REFRESH_DELAY_MS);
    }

    private refresh(): void {
        if (!this.enabled) return;
        const { candidates } = collectOfficialConversationNavigationCandidates();
        const next = new Set(candidates);

        for (const element of Array.from(this.hiddenElements)) {
            if (next.has(element) && element.isConnected) continue;
            element.removeAttribute(HIDDEN_ATTR);
            element.hidden = false;
            this.hiddenElements.delete(element);
        }

        for (const element of candidates) {
            element.setAttribute(HIDDEN_ATTR, '1');
            element.hidden = true;
            this.hiddenElements.add(element);
        }
    }

    private clearHiddenElements(): void {
        for (const element of Array.from(this.hiddenElements)) {
            element.removeAttribute(HIDDEN_ATTR);
            element.hidden = false;
        }
        this.hiddenElements.clear();
    }

    private ensureStyle(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
[${HIDDEN_ATTR}="1"],
${OFFICIAL_NAV_FIXED_CHILD_SELECTOR} {
  display: none;
}
`;
        document.head.appendChild(style);
    }

    private removeStyle(): void {
        document.getElementById(STYLE_ID)?.remove();
    }
}
