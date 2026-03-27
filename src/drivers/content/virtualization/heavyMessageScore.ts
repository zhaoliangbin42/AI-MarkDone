export type HeavyMessageScore = {
    nodeCount: number;
    katexNodeCount: number;
    textLength: number;
    heavy: boolean;
};

export function scoreHeavyMessage(
    root: HTMLElement,
    thresholds: { nodeThreshold: number; katexThreshold: number }
): HeavyMessageScore {
    const nodeCount = root.querySelectorAll('*').length + 1;
    const katexNodeCount = root.querySelectorAll('.katex, .katex-display, math').length;
    const textLength = (root.textContent || '').trim().length;

    return {
        nodeCount,
        katexNodeCount,
        textLength,
        heavy: nodeCount >= thresholds.nodeThreshold || katexNodeCount >= thresholds.katexThreshold,
    };
}
