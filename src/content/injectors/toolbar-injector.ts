import { SiteAdapter } from '../adapters/base';
import { logger } from '../../utils/logger';

/**
 * Toolbar state machine
 */
export enum ToolbarState {
    NULL = 'null',           // Not created
    INJECTED = 'injected',   // DOM created and inserted, but hidden (display: none)
    ACTIVE = 'active'        // Initialized and visible (display: flex)
}

/**
 * Toolbar injector with state machine architecture.
 * Separates injection (hidden DOM creation) from activation (show + initialize).
 */
export class ToolbarInjector {
    private adapter: SiteAdapter;
    private messageStates = new WeakMap<HTMLElement, ToolbarState>();
    private messageWrappers = new WeakMap<HTMLElement, HTMLElement>();

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    /**
     * Stage 1: Inject toolbar (hidden state)
     * Creates DOM and inserts into page, but keeps it hidden.
     */
    inject(messageElement: HTMLElement, toolbar: HTMLElement): boolean {
        const currentState = this.getState(messageElement);

        // Skip if already injected or active
        if (currentState !== ToolbarState.NULL) {
            return false;
        }

        // Create wrapper and insert (hidden)
        const wrapper = this.createWrapper(toolbar);
        wrapper.style.display = 'none';

        // Use adapter's injectToolbar method for platform-specific injection logic
        // Each adapter handles its own fallback logic if action bar is not found
        let injected = false;
        try {
            injected = this.adapter.injectToolbar(messageElement, wrapper);
        } catch (err) {
            logger.warn('[Injector] Adapter injectToolbar threw; will fallback inject:', err);
            injected = false;
        }

        // Some adapters may append to DOM but return false; treat connected wrapper as success.
        if (!injected && wrapper.isConnected) {
            injected = true;
        }

        // Last-resort fallback to avoid global "no toolbar" failures when anchors shift.
        if (!injected) {
            injected = this.fallbackInject(messageElement, wrapper);
        }

        if (!injected) {
            logger.warn('[Injector] Failed to inject toolbar (adapter + fallback)');
            return false;
        }

        // Update state
        this.messageStates.set(messageElement, ToolbarState.INJECTED);
        this.messageWrappers.set(messageElement, wrapper);
        return true;
    }

    private fallbackInject(messageElement: HTMLElement, wrapper: HTMLElement): boolean {
        try {
            const contentSelector = this.adapter.getMessageContentSelector();
            if (contentSelector) {
                const content = messageElement.querySelector(contentSelector);
                if (content && content.parentElement) {
                    content.insertAdjacentElement('afterend', wrapper);
                    logger.debug('[Injector] Fallback injected after message content');
                    return true;
                }
            }
        } catch {
            // ignore selector/DOM errors; continue to append
        }

        try {
            messageElement.appendChild(wrapper);
            logger.debug('[Injector] Fallback injected by appending to message');
            return true;
        } catch (err) {
            logger.warn('[Injector] Fallback append failed:', err);
            return false;
        }
    }

    /**
     * Stage 2: Activate toolbar (visible + initialized)
     * Makes toolbar visible and returns true to signal word count initialization.
     */
    activate(messageElement: HTMLElement): boolean {
        const currentState = this.getState(messageElement);

        // Only activate if in INJECTED state
        if (currentState !== ToolbarState.INJECTED) {
            return false;
        }

        // Find wrapper (prefer tracked reference; fallback to query)
        const wrapper = (this.messageWrappers.get(messageElement) ||
            (messageElement.querySelector('.aicopy-toolbar-wrapper') as HTMLElement | null)) as HTMLElement | null;
        if (!wrapper) {
            logger.error('[Injector] activate() failed: Wrapper not found in DOM');
            this.messageStates.set(messageElement, ToolbarState.NULL);
            return false;
        }

        // If SPA re-render removed it, reset and let observer re-inject.
        if (!wrapper.isConnected) {
            logger.warn('[Injector] activate() wrapper is disconnected; resetting state to NULL');
            this.messageStates.set(messageElement, ToolbarState.NULL);
            return false;
        }

        // Make visible
        wrapper.style.display = 'flex';

        // Update state
        this.messageStates.set(messageElement, ToolbarState.ACTIVE);
        return true;
    }

    /**
     * Get current state of toolbar for a message
     */
    getState(messageElement: HTMLElement): ToolbarState {
        const state = this.messageStates.get(messageElement) || ToolbarState.NULL;

        // Self-heal: if the wrapper was removed by SPA re-render/hydration,
        // do not keep returning INJECTED/ACTIVE forever.
        if (state !== ToolbarState.NULL) {
            const wrapper = this.messageWrappers.get(messageElement);
            if (wrapper && !wrapper.isConnected) {
                logger.warn('[Injector] Wrapper disconnected; downgrading state to NULL');
                this.messageStates.set(messageElement, ToolbarState.NULL);
                return ToolbarState.NULL;
            }
        }

        return state;
    }

    /**
     * Clear internal state for message (used when cleaning up or self-healing)
     */
    public resetMessageState(messageElement: HTMLElement): void {
        this.messageStates.set(messageElement, ToolbarState.NULL);
        this.messageWrappers.delete(messageElement);
    }

    /**
     * Reconcile toolbar position (legacy compatibility)
     * Ensures toolbar is correctly positioned before action bar.
     */
    public reconcileToolbarPosition(message: HTMLElement): void {
        const selector = this.adapter.getActionBarSelector();
        const actionBar = message.querySelector(selector);
        const wrapper = message.querySelector('.aicopy-toolbar-wrapper');

        if (!wrapper || !actionBar || !actionBar.parentElement) {
            return;
        }

        // Only move if order is wrong
        if (wrapper.nextElementSibling !== actionBar) {
            requestAnimationFrame(() => {
                if (wrapper.isConnected && actionBar.isConnected) {
                    actionBar.parentElement?.insertBefore(wrapper, actionBar);
                    logger.debug('[Injector] Toolbar position reconciled');
                }
            });
        }
    }

    private createWrapper(toolbar: HTMLElement): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'aicopy-toolbar-wrapper';

        wrapper.style.position = 'relative';
        // Set margin-left: auto on toolbar container for right alignment
        toolbar.style.position = 'absolute';
        toolbar.style.right = '0';
        toolbar.style.zIndex = 'var(--aimd-z-base)';

        wrapper.appendChild(toolbar);
        return wrapper;
    }

    /**
     * Remove toolbar from a message element
     */
    remove(messageElement: HTMLElement): boolean {
        const wrapper = messageElement.querySelector('.aicopy-toolbar-wrapper');
        if (wrapper) {
            wrapper.remove();
            this.messageStates.delete(messageElement);
            logger.debug('[Injector] Toolbar removed');
            return true;
        }
        return false;
    }

    /**
     * Check if toolbar is already injected (INJECTED or ACTIVE state)
     */
    isInjected(messageElement: HTMLElement): boolean {
        const state = this.getState(messageElement);
        return state === ToolbarState.INJECTED || state === ToolbarState.ACTIVE;
    }

    /**
     * Cleanup state
     */
    cleanup(): void {
        this.messageStates = new WeakMap<HTMLElement, ToolbarState>();
        logger.info('[Injector] Cleaned up state');
    }
}
