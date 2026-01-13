import { logger } from '../../utils/logger';
import { createMarkdownParser } from '../../parser-example';
import { adapterRegistry } from '../adapters/registry';

/**
 * MarkdownParser - Uses new v3 high-performance parser
 *
 * Old unified pipeline has been removed to reduce bundle size (~1.5MB savings)
 */
export class MarkdownParser {
    private parser = createMarkdownParser({
        enablePerformanceLogging: true,
    });

    /**
     * Parse HTML element to Markdown with noise filtering
     *
     * Pre-processes DOM to remove platform-specific noise before markdown conversion
     * @param element - HTML element to parse
     * @returns Markdown string
     */
    parse(element: HTMLElement): string {
        logger.debug('[MarkdownParser] Using v3 parser with noise filtering');
        const startTime = performance.now();

        // Step 1: Clone element to avoid mutating original DOM
        const clone = element.cloneNode(true) as HTMLElement;

        // Step 1.5: Normalize DOM structure (platform-specific fixups)
        const adapter = adapterRegistry.getAdapter();
        if (adapter) {
            adapter.normalizeDOM(clone);
            logger.debug('[MarkdownParser] Normalized DOM structure');
        }

        // Step 2: Process noise nodes (replace with placeholders or remove)
        this.processNoiseNodes(clone);

        // Step 3: Parse cleaned DOM to markdown
        const markdown = this.parser.parse(clone);
        const elapsed = performance.now() - startTime;

        logger.debug(`[Markdown Parser] Parsed in ${elapsed.toFixed(2)}ms`);
        return markdown;
    }

    /**
     * Process platform-specific noise nodes from DOM tree
     * Uses adapter's isNoiseNode() and getArtifactPlaceholder() methods
     *
     * @param root - Root element to clean (will be mutated)
     */
    private processNoiseNodes(root: HTMLElement): void {
        const adapter = adapterRegistry.getAdapter();
        if (!adapter) {
            logger.warn('[MarkdownParser] No adapter found, skipping noise filtering');
            return;
        }

        // TreeWalker for efficient DOM traversal
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT
        );

        const nodesToProcess: { node: Node; placeholder?: string }[] = [];
        let node: Node | null;

        // Collect nodes to process (can't modify during traversal)
        while ((node = walker.nextNode())) {
            try {
                const nextSibling = (node as Element).nextElementSibling;
                if (adapter.isNoiseNode(node, { nextSibling })) {
                    // Check if adapter provides a placeholder for this node
                    const placeholder = adapter.getArtifactPlaceholder?.(node as HTMLElement);
                    nodesToProcess.push({ node, placeholder });
                }
            } catch (error) {
                logger.warn('[MarkdownParser] Noise detection error, skipping node:', error);
            }
        }

        // Process in reverse order (children before parents)
        nodesToProcess.reverse().forEach(({ node, placeholder }) => {
            if (placeholder) {
                // Replace with placeholder text
                const placeholderEl = document.createElement('p');
                placeholderEl.textContent = placeholder;
                node.parentNode?.replaceChild(placeholderEl, node);
                logger.debug('[MarkdownParser] Replaced noise node with placeholder:', placeholder);
            } else {
                // Remove completely
                node.parentNode?.removeChild(node);
                logger.debug('[MarkdownParser] Removed noise node');
            }
        });

        if (nodesToProcess.length > 0) {
            logger.debug(`[MarkdownParser] Processed ${nodesToProcess.length} noise nodes`);
        }
    }
}
