import { SiteAdapter } from '../adapters/base';
import { logger } from '../../utils/logger';

export enum ToolbarState {
    NULL = 'null',
    INJECTED = 'injected',
    ACTIVE = 'active'
}

export class ToolbarInjector {
    private adapter: SiteAdapter;
    private messageStates = new WeakMap<HTMLElement, ToolbarState>();
    private messageWrappers = new WeakMap<HTMLElement, HTMLElement>();

    constructor(adapter: SiteAdapter) {
        this.adapter = adapter;
    }

    inject(messageElement: HTMLElement, toolbar: HTMLElement): boolean {
        const currentState = this.getState(messageElement);

        if (currentState !== ToolbarState.NULL) {
            return false;
        }

        const wrapper = this.createWrapper(toolbar);
        wrapper.style.display = 'none';

        let injected = false;
        try {
            injected = this.adapter.injectToolbar(messageElement, wrapper);
        } catch (err) {
            logger.warn('[Injector] Adapter injectToolbar threw; will fallback inject:', err);
            injected = false;
        }

        // Some adapters may append to DOM but return false; treat a connected wrapper as success.
        if (!injected && wrapper.isConnected) {
            injected = true;
        }

        // Why: SPAs sometimes shift/remove anchors; keep a last-resort fallback to avoid global "no toolbar".
        if (!injected) {
            injected = this.fallbackInject(messageElement, wrapper);
        }

        if (!injected) {
            logger.warn('[Injector] Failed to inject toolbar (adapter + fallback)');
            return false;
        }

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

    activate(messageElement: HTMLElement): boolean {
        const currentState = this.getState(messageElement);

        if (currentState !== ToolbarState.INJECTED) {
            return false;
        }

        const wrapper = (this.messageWrappers.get(messageElement) ||
            (messageElement.querySelector('.aicopy-toolbar-wrapper') as HTMLElement | null)) as HTMLElement | null;
        if (!wrapper) {
            logger.error('[Injector] activate() failed: Wrapper not found in DOM');
            this.messageStates.set(messageElement, ToolbarState.NULL);
            return false;
        }

        // Why: SPA re-render/hydration can remove injected nodes; reset and let observer re-inject.
        if (!wrapper.isConnected) {
            logger.warn('[Injector] activate() wrapper is disconnected; resetting state to NULL');
            this.messageStates.set(messageElement, ToolbarState.NULL);
            return false;
        }

        wrapper.style.display = 'flex';

        this.messageStates.set(messageElement, ToolbarState.ACTIVE);
        return true;
    }

    getState(messageElement: HTMLElement): ToolbarState {
        const state = this.messageStates.get(messageElement) || ToolbarState.NULL;

        // Why: self-heal if SPA removed the wrapper; avoid returning stale INJECTED/ACTIVE forever.
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

    public resetMessageState(messageElement: HTMLElement): void {
        this.messageStates.set(messageElement, ToolbarState.NULL);
        this.messageWrappers.delete(messageElement);
    }

    public reconcileToolbarPosition(message: HTMLElement): void {
        const selector = this.adapter.getActionBarSelector();
        let actionBar = message.querySelector(selector) as HTMLElement | null;
        const wrapper = message.querySelector('.aicopy-toolbar-wrapper');

        if (!wrapper || !actionBar || !actionBar.parentElement) {
            return;
        }

        // Some adapters (e.g. ChatGPT) use a selector that targets a stable anchor button
        // inside the action bar rather than the bar container itself.
        //
        // IMPORTANT: Only promote to a container when we can identify the ChatGPT bar wrapper.
        // For other platforms whose action bar selector already targets a button, promoting to
        // parent containers would change placement semantics.
        if (actionBar.tagName.toLowerCase() === 'button') {
            const chatgptBar = actionBar.closest('div.z-0.flex') as HTMLElement | null;
            if (chatgptBar) {
                actionBar = chatgptBar;
            }
        }

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
        toolbar.style.position = 'absolute';
        toolbar.style.right = '0';
        toolbar.style.zIndex = 'var(--aimd-z-base)';

        wrapper.appendChild(toolbar);
        return wrapper;
    }

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

    isInjected(messageElement: HTMLElement): boolean {
        const state = this.getState(messageElement);
        return state === ToolbarState.INJECTED || state === ToolbarState.ACTIVE;
    }

    cleanup(): void {
        this.messageStates = new WeakMap<HTMLElement, ToolbarState>();
        logger.info('[Injector] Cleaned up state');
    }
}
