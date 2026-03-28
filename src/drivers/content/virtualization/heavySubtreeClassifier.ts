export type HeavySubtreeThresholds = {
    katexNodeThreshold: number;
    codeNodeThreshold: number;
    largeBlockHeightPx: number;
};

function countSubtreeNodes(root: HTMLElement, selector: string): number {
    return root.matches(selector) ? root.querySelectorAll(selector).length + 1 : root.querySelectorAll(selector).length;
}

function isCodeHeavy(root: HTMLElement, thresholds: HeavySubtreeThresholds): boolean {
    if (!root.matches('pre, code')) return false;
    const codeNodeCount = countSubtreeNodes(root, 'pre, code, pre *, code *');
    return codeNodeCount >= thresholds.codeNodeThreshold || root.offsetHeight >= thresholds.largeBlockHeightPx;
}

function isKatexHeavy(root: HTMLElement, thresholds: HeavySubtreeThresholds): boolean {
    if (!root.matches('.katex, .katex-display, math')) return false;
    const katexNodeCount = countSubtreeNodes(root, '.katex, .katex-display, math, .katex *, .katex-display *, math *');
    return katexNodeCount >= thresholds.katexNodeThreshold;
}

export function classifyHeavySubtrees(targets: HTMLElement[], thresholds: HeavySubtreeThresholds): HTMLElement[] {
    const selected: HTMLElement[] = [];

    for (const target of targets) {
        if (selected.some((existing) => existing.contains(target) || target.contains(existing))) {
            continue;
        }
        if (isKatexHeavy(target, thresholds) || isCodeHeavy(target, thresholds)) {
            selected.push(target);
        }
    }

    return selected;
}
