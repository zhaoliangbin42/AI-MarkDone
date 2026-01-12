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

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    /**
     * Stage 1: Inject toolbar (hidden state)
     * Creates DOM and inserts into page, but keeps it hidden.
     */
    inject(messageElement: HTMLElement, toolbar: HTMLElement): boolean {
        const currentState = this.getState(messageElement);

        logger.info(`[toolbar] 🔧 inject() called. currentState=${currentState}`);

        // Skip if already injected or active
        if (currentState !== ToolbarState.NULL) {
            logger.info(`[toolbar] ⏭️  inject() skipped: already ${currentState}`);
            return false;
        }

        // Find action bar
        const selector = this.adapter.getActionBarSelector();
        const actionBar = messageElement.querySelector(selector);

        if (!actionBar || !actionBar.parentElement) {
            return false;
        }

        // Create wrapper and insert (hidden)
        const wrapper = this.createWrapper(toolbar);

        // 🔑 Key: Insert hidden
        wrapper.style.display = 'none';

        // Use adapter's injectToolbar method for platform-specific injection logic
        // This delegates the injection strategy to each platform adapter
        const injected = this.adapter.injectToolbar(messageElement, wrapper);

        if (!injected) {
            logger.warn('[toolbar] ❌ Adapter failed to inject toolbar');
            return false;
        }

        // Update state
        this.messageStates.set(messageElement, ToolbarState.INJECTED);

        return true;
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

        // Find wrapper
        const wrapper = messageElement.querySelector('.aicopy-toolbar-wrapper') as HTMLElement;
        if (!wrapper) {
            logger.error(`[toolbar] ❌ activate() failed: Wrapper not found in DOM`);
            return false;
        }

        logger.info(`[toolbar] 👁️  Making wrapper visible (display: flex)`);

        // 🔑 Key: Make visible
        wrapper.style.display = 'flex';

        // Update state
        this.messageStates.set(messageElement, ToolbarState.ACTIVE);

        return true;
    }

    /**
     * Get current state of toolbar for a message
     */
    getState(messageElement: HTMLElement): ToolbarState {
        return this.messageStates.get(messageElement) || ToolbarState.NULL;
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
