/**
 * StreamingDetector - Cross-Platform Streaming Completion Detection
 * 
 * Location: src/content/adapters/streaming-detector.ts
 * 
 * This is a platform-agnostic utility that uses SiteAdapter.getCopyButtonSelector()
 * to detect when a streaming message has completed.
 * 
 * Used by:
 * - MessageObserver (toolbar activation)
 * - ReaderPanel (trigger button state)
 * 
 * Signal: Copy button count increase = message streaming complete
 */

import { SiteAdapter } from './base';
import { debounce } from '../../utils/dom-utils';
import { logger } from '../../utils/logger';

export type StreamingCompleteCallback = () => void;

export class StreamingDetector {
    private adapter: SiteAdapter;
    private observer: MutationObserver | null = null;
    private lastCount: number = 0;
    private onComplete: StreamingCompleteCallback | null = null;

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    /**
     * Start watching for streaming completion (copy button appears)
     * @param onComplete - Callback when streaming is detected as complete
     * @returns Cleanup function to stop watching
     */
    startWatching(onComplete: StreamingCompleteCallback): () => void {
        this.onComplete = onComplete;
        const selector = this.adapter.getCopyButtonSelector();

        // Record initial count
        this.lastCount = document.querySelectorAll(selector).length;
        logger.debug(`[StreamingDetector] Starting watch. Initial count: ${this.lastCount}`);

        // Debounced handler (same as mutation-observer.ts)
        const handleChange = debounce(() => {
            const currentCount = document.querySelectorAll(selector).length;
            if (currentCount > this.lastCount) {
                logger.info(`[StreamingDetector] Copy button added: ${this.lastCount} → ${currentCount}`);
                this.lastCount = currentCount;
                this.stopWatching();
                this.onComplete?.();
            }
        }, 300);

        // MutationObserver (exact same logic as mutation-observer.ts)
        this.observer = new MutationObserver((mutations) => {
            let foundNewButton = false;

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        if (node.matches(selector) || node.querySelector(selector)) {
                            foundNewButton = true;
                            break;
                        }
                    }
                }
                if (foundNewButton) break;
            }

            if (foundNewButton) {
                handleChange();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        logger.debug('[StreamingDetector] Observer started');

        return () => this.stopWatching();
    }

    /**
     * Stop watching
     */
    stopWatching(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            logger.debug('[StreamingDetector] Observer stopped');
        }
    }
}
