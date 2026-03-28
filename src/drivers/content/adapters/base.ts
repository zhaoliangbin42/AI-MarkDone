import type { Theme } from '../../../core/types/theme';
import type { MarkdownParserAdapter } from './parser/MarkdownParserAdapter';

export interface ThemeDetector {
    detect(): Theme | null;
    getObserveTargets(): Array<{ element: 'html' | 'body'; attributes: string[] }>;
    hasExplicitTheme(): boolean;
}

export type NoiseContext = { nextSibling: Element | null };

export type ConversationGroupRef = {
    id: string;
    assistantRootEl: HTMLElement;
    assistantMessageEl: HTMLElement;
    userRootEl: HTMLElement | null;
    groupEls: HTMLElement[];
    assistantIndex: number;
    isStreaming: boolean;
};

export abstract class SiteAdapter {
    abstract matches(url: string): boolean;
    abstract getPlatformId(): string;
    abstract getThemeDetector(): ThemeDetector;

    // =========================
    // Copy / Message discovery
    // =========================

    /**
     * Extract the user prompt that corresponds to this assistant message.
     *
     * Used by Reader pagination titles/tooltips.
     *
     * Constraints:
     * - Structural extraction only (avoid language/text-based heuristics).
     * - Must return a stable, user-readable string or `null` if unavailable.
     */
    abstract extractUserPrompt(assistantMessageElement: HTMLElement): string | null;

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
     * Stable anchor element for the message's official bottom toolbar/action row.
     *
     * This is the sole source of truth for per-message toolbar injection.
     * If the official toolbar is absent, return `null` and callers must not inject.
     */
    abstract getToolbarAnchorElement(_assistantMessageElement: HTMLElement): HTMLElement | null;

    /**
     * Optional: returns a stable DOM element that represents the "logical turn root"
     * containing this assistant message segment.
     *
     * Used by conversation turn grouping (Reader / Export / navigation). Platforms should
     * prefer structural keys (turn wrapper containers) over text heuristics.
     *
     * If omitted, turn grouping falls back to platform-agnostic best-effort heuristics.
     */
    getTurnRootElement?(_assistantMessageElement: HTMLElement): HTMLElement | null;

    /**
     * Optional stable scroll root for conversation virtualization.
     */
    getConversationScrollRoot?(): HTMLElement | null;

    /**
     * Optional platform-owned conversation grouping for virtualization.
     */
    getConversationGroupRefs?(): ConversationGroupRef[];

    /**
     * Optional gate for whether a message can be virtualized.
     */
    isVirtualizationEligibleMessage?(_assistantMessageElement: HTMLElement): boolean;

    /**
     * Optional platform-owned heavy subtree hints for stable-state performance optimizations.
     *
     * Callers pass mounted body roots; adapters return candidate heavy subtree roots using
     * structural selectors only.
     */
    getHeavySubtreeRefs?(_bodyEls: HTMLElement[]): HTMLElement[];

    /**
     * Platform-specific injection strategy for a per-message toolbar host element.
     *
     * Implementations must inject only into the official toolbar/action row.
     * If the official toolbar is absent, this must return `false` without fallback placement.
     */
    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        const actionBar = this.getToolbarAnchorElement(messageElement);
        if (!actionBar) return false;
        actionBar.appendChild(toolbarHost);
        return true;
    }

    /**
     * True if this message is still streaming (incomplete).
     */
    abstract isStreamingMessage(messageElement: HTMLElement): boolean;

    /**
     * A stable-ish identifier for a message element.
     *
     * Preferred use: logical message identity across rescans/re-renders.
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

    /**
     * Optional parser capability owned by the driver layer.
     *
     * Service/parser core consumes this contract without branching on platform ids.
     */
    getMarkdownParserAdapter(): MarkdownParserAdapter | null {
        return null;
    }

    /**
     * Optional stable anchor for the page-level header icon entry.
     *
     * Why: page headers are often re-rendered independently from message containers.
     * The runtime owns lifecycle; adapters own header DOM differences.
     */
    getHeaderIconAnchorElement(): HTMLElement | null {
        return null;
    }

    /**
     * Platform-specific injection strategy for the page-level header icon host.
     */
    injectHeaderIcon(iconHost: HTMLElement): boolean {
        const anchor = this.getHeaderIconAnchorElement();
        if (!anchor) return false;
        anchor.appendChild(iconHost);
        return true;
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

    // =========================
    // Message sending (composer)
    // =========================

    /**
     * Return the platform's native composer input element.
     *
     * Notes:
     * - Prefer the "real" editor element (e.g. contenteditable ProseMirror root) when present.
     * - Must return a stable element for DOM-based message sending.
     */
    getComposerInputElement?(): HTMLElement | HTMLTextAreaElement | HTMLInputElement | null;

    /**
     * Return the platform's native "send" button element.
     *
     * This may represent a multi-state button (e.g. voice when empty, send when text present).
     */
    getComposerSendButtonElement?(): HTMLElement | null;

    /**
     * Optional: best-effort "streaming in progress" signal at the composer level.
     */
    isComposerStreaming?(): boolean;

    /**
     * Optional: declare the composer kind for this platform.
     * If omitted, the sending driver will derive it from the returned element.
     */
    getComposerKind?(): 'textarea' | 'contenteditable' | 'unknown';
}
