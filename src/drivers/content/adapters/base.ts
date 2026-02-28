import type { Theme } from '../../../core/types/theme';

export interface ThemeDetector {
    detect(): Theme | null;
    getObserveTargets(): Array<{ element: 'html' | 'body'; attributes: string[] }>;
    hasExplicitTheme(): boolean;
}

export type NoiseContext = { nextSibling: Element | null };

export abstract class SiteAdapter {
    abstract matches(url: string): boolean;
    abstract getPlatformId(): string;
    abstract getThemeDetector(): ThemeDetector;

    // =========================
    // Copy / Message discovery
    // =========================

    /**
     * Select assistant message container elements (NOT user prompts).
     * Must be stable enough to drive per-message toolbar injection.
     */
    abstract getMessageSelector(): string;

    /**
     * Select the "real content" container inside a message element.
     * The Copy service will parse this node (or fallback to the message element).
     */
    abstract getMessageContentSelector(): string;

    /**
     * Optional anchor to detect message completion (action bar / footer with copy button).
     * Used for streaming guards and pending UI states.
     */
    abstract getActionBarSelector(): string;

    /**
     * Platform-specific injection strategy for a per-message toolbar host element.
     */
    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const actionBar = messageElement.querySelector(this.getActionBarSelector());
        if (!actionBar || !actionBar.parentElement) {
            return false;
        }
        actionBar.parentElement.insertBefore(toolbarHost, actionBar);
        return true;
    }

    /**
     * True if this message is still streaming (incomplete).
     */
    abstract isStreamingMessage(messageElement: HTMLElement): boolean;

    /**
     * A stable-ish identifier for a message element (for deduping injections).
     */
    abstract getMessageId(messageElement: HTMLElement): string | null;

    /**
     * Container for MutationObserver to watch new messages.
     */
    abstract getObserverContainer(): HTMLElement | null;

    /**
     * Best-effort: return the "last assistant message element".
     */
    getLastMessageElement(): HTMLElement | null {
        const selector = this.getMessageSelector();
        const nodes = Array.from(document.querySelectorAll(selector)).filter(
            (n): n is HTMLElement => n instanceof HTMLElement
        );
        return nodes.length > 0 ? nodes[nodes.length - 1] : null;
    }

    /**
     * Platform-specific DOM fixups on the cloned content root (safe to mutate).
     */
    normalizeDOM(_root: HTMLElement): void {
        // no-op by default
    }

    /**
     * Platform-specific noise filtering hook (artifact cards, action bars, etc).
     * Called on cloned content root only.
     */
    isNoiseNode(_node: Node, _context: NoiseContext): boolean {
        return false;
    }

    /**
     * Optional: if a noise node should be represented as a placeholder paragraph instead of removed.
     */
    getArtifactPlaceholder(_node: HTMLElement): string | null {
        return null;
    }

    // =========================
    // Optional platform extras
    // =========================

    /**
     * If true, Copy pipeline should apply the "unrendered inline math repair" step.
     * Default: false; ChatGPT legacy behavior: true.
     */
    shouldEnhanceUnrenderedMath(): boolean {
        return false;
    }

    /**
     * Deep Research message detection (optional).
     */
    isDeepResearchMessage?(_messageElement: HTMLElement): boolean;

    /**
     * If a Deep Research panel is open, return its content root for parsing.
     */
    getDeepResearchContent?(): HTMLElement | null;
}
