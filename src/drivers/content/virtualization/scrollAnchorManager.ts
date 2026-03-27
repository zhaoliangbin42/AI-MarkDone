type ScrollSnapshot = {
    scrollTop: number;
    anchorTop: number;
};

function getViewportTop(root: HTMLElement): number {
    return root === document.documentElement || root === document.body ? 0 : root.getBoundingClientRect().top;
}

export class ScrollAnchorManager {
    capture(root: HTMLElement, anchor: HTMLElement | null): ScrollSnapshot {
        return {
            scrollTop: root.scrollTop,
            anchorTop: anchor ? anchor.getBoundingClientRect().top - getViewportTop(root) : 0,
        };
    }

    compensate(root: HTMLElement, anchor: HTMLElement | null, before: ScrollSnapshot): void {
        if (!anchor) {
            root.scrollTop = before.scrollTop;
            return;
        }
        const nextTop = anchor.getBoundingClientRect().top - getViewportTop(root);
        root.scrollTop += nextTop - before.anchorTop;
    }
}
