/**
 * FloatingInput - UI Component for Message Sending
 * 
 * A floating input box that appears above the trigger button in ReaderPanel.
 * 
 * Features:
 * - Expands from trigger button position
 * - Resizable (min: 280x150, max: panel size)
 * - Collapse button (top) + Send button (bottom-right)
 * - Smooth animations
 */

import { Icons } from '../../assets/icons';
import { logger } from '../../utils/logger';
import { setupKeyboardIsolation } from '../../utils/dom-utils';
import { i18n } from '../../utils/i18n';

export interface FloatingInputOptions {
    /** Callback when user clicks send button */
    onSend?: (text: string) => void;
    /** Callback when input box is collapsed */
    onCollapse?: (text: string) => void;
    /** Callback when text changes */
    onInput?: (text: string) => void;
    /** Initial text content */
    initialText?: string;
}

export class FloatingInput {
    // Static size memory - persists across instances within session
    private static savedWidth: number | null = null;
    private static savedHeight: number | null = null;

    private container: HTMLElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private sendBtn: HTMLButtonElement | null = null;
    private isVisible: boolean = false;
    private options: FloatingInputOptions;
    private shadowRoot: ShadowRoot | null = null;
    private outsideClickHandler: EventListener | null = null;

    constructor(options: FloatingInputOptions = {}) {
        this.options = options;
    }

    /**
     * Show the floating input box
     * @param anchorElement - The element to anchor the floating box to
     */
    show(anchorElement: HTMLElement): void {
        if (this.isVisible) {
            this.hide();
            return;
        }

        this.container = this.createElement();

        // Get shadow root for outside click handling
        this.shadowRoot = anchorElement.getRootNode() as ShadowRoot;

        // Position relative to anchor's parent
        const parentElement = anchorElement.parentElement;

        if (parentElement) {
            parentElement.style.position = 'relative';
            parentElement.appendChild(this.container);
        }

        // Set initial text if provided
        if (this.options.initialText && this.textarea) {
            this.textarea.value = this.options.initialText;
        }

        // Focus textarea
        this.textarea?.focus();

        this.isVisible = true;
        logger.debug('[FloatingInput] Shown');

        // Setup outside click handler
        this.setupOutsideClickHandler();
    }

    /**
     * Hide the floating input box with animation
     */
    hide(): void {
        if (!this.container || !this.isVisible) return;

        // Get text before removal
        const text = this.textarea?.value || '';

        // Add collapse animation
        this.container.classList.add('collapsing');

        // Fire callback
        this.options.onCollapse?.(text);

        // Remove outside click handler
        if (this.outsideClickHandler && this.shadowRoot) {
            this.shadowRoot.removeEventListener('click', this.outsideClickHandler, true);
            this.outsideClickHandler = null;
        }

        // Remove after animation
        setTimeout(() => {
            this.container?.remove();
            this.container = null;
            this.textarea = null;
            this.sendBtn = null;
            this.isVisible = false;
            this.shadowRoot = null;
            logger.debug('[FloatingInput] Hidden');
        }, 150);
    }

    /**
     * Toggle visibility
     */
    toggle(anchorElement: HTMLElement): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(anchorElement);
        }
    }

    /**
     * Get current text content
     */
    getText(): string {
        return this.textarea?.value || '';
    }

    /**
     * Set text content
     */
    setText(text: string): void {
        if (this.textarea) {
            this.textarea.value = text;
        }
    }

    /**
     * Set send button disabled state
     */
    setSendDisabled(disabled: boolean): void {
        if (this.sendBtn) {
            this.sendBtn.disabled = disabled;
        }
    }

    /**
     * Check if currently visible
     */
    get visible(): boolean {
        return this.isVisible;
    }

    /**
     * Destroy and cleanup
     */
    destroy(): void {
        // Remove outside click handler
        if (this.outsideClickHandler && this.shadowRoot) {
            this.shadowRoot.removeEventListener('click', this.outsideClickHandler, true);
            this.outsideClickHandler = null;
        }

        this.container?.remove();
        this.container = null;
        this.textarea = null;
        this.sendBtn = null;
        this.isVisible = false;
        this.shadowRoot = null;
    }

    /**
     * Create the floating input DOM structure
     */
    private createElement(): HTMLElement {
        const container = document.createElement('div');
        container.className = 'aimd-floating-input';

        // Top-right resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'aimd-resize-handle';
        this.setupResizeHandle(resizeHandle, container);
        container.appendChild(resizeHandle);

        // Header with title and collapse button
        const header = document.createElement('div');
        header.className = 'aimd-float-header';

        // Title on the left
        const title = document.createElement('span');
        title.className = 'aimd-float-title';
        title.textContent = i18n.t('inputMessage');
        header.appendChild(title);

        // Collapse button on the right
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'aimd-float-collapse-btn';
        collapseBtn.title = i18n.t('collapse');
        collapseBtn.innerHTML = Icons.chevronDown;
        collapseBtn.addEventListener('click', () => this.hide());
        header.appendChild(collapseBtn);

        // Body with textarea
        const body = document.createElement('div');
        body.className = 'aimd-float-body';

        this.textarea = document.createElement('textarea');
        this.textarea.className = 'aimd-float-textarea';
        this.textarea.placeholder = i18n.t('typeYourMessage');

        // Event isolation: prevent host page from intercepting keyboard events
        setupKeyboardIsolation(this.textarea, { componentName: 'FloatingInput' });

        this.textarea.addEventListener('input', (e) => {
            e.stopPropagation();
            this.options.onInput?.(this.textarea?.value || '');
        });

        // Handle Escape to collapse
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.hide();
            }
        });

        body.appendChild(this.textarea);

        // Footer with send button
        const footer = document.createElement('div');
        footer.className = 'aimd-float-footer';

        this.sendBtn = document.createElement('button');
        this.sendBtn.className = 'aimd-float-send-btn';
        this.sendBtn.title = i18n.t('send');
        this.sendBtn.innerHTML = Icons.send;
        this.sendBtn.addEventListener('click', () => {
            const text = this.textarea?.value.trim() || '';
            if (text) {
                this.options.onSend?.(text);
            }
        });
        footer.appendChild(this.sendBtn);

        // Assemble
        container.appendChild(header);
        container.appendChild(body);
        container.appendChild(footer);

        // Restore saved size if available
        if (FloatingInput.savedWidth) {
            container.style.width = `${FloatingInput.savedWidth}px`;
        }
        if (FloatingInput.savedHeight) {
            container.style.height = `${FloatingInput.savedHeight}px`;
        }

        return container;
    }

    /**
     * Setup click outside handler to collapse (Shadow DOM aware)
     */
    private setupOutsideClickHandler(): void {
        this.outsideClickHandler = ((e: Event) => {
            if (!this.container || !this.isVisible) {
                return;
            }

            const path = e.composedPath();

            // Check if click is inside the floating input or trigger button
            const clickedInside = path.some(el => {
                if (el instanceof HTMLElement) {
                    return el === this.container ||
                        el.classList.contains('aimd-trigger-btn') ||
                        el.classList.contains('aimd-trigger-btn-wrapper');
                }
                return false;
            });

            if (!clickedInside) {
                this.hide();
            }
        }) as EventListener;

        // Use capturing phase on shadow root
        setTimeout(() => {
            this.shadowRoot?.addEventListener('click', this.outsideClickHandler!, true);
        }, 100);
    }


    /**
     * Setup resize handle drag behavior
     */
    private setupResizeHandle(handle: HTMLElement, container: HTMLElement): void {
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        const onMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX;
            const deltaY = startY - e.clientY; // Inverted for top-right

            const newWidth = Math.max(280, Math.min(startWidth + deltaX, 800));

            // Calculate max height based on available space above the floating input
            const containerRect = container.getBoundingClientRect();
            const bottomY = containerRect.bottom;

            let topLimit = 20; // Default: 20px from viewport top

            // Try to find the parent Reader Panel to respect its header
            // Since we are in Shadow DOM, we might need to look outside or query specifically
            if (this.shadowRoot) {
                const panel = this.shadowRoot.querySelector('.aicopy-panel');
                if (panel) {
                    const panelRect = panel.getBoundingClientRect();
                    const headerHeight = 60; // Approximate header height (includes padding)
                    // The limit is the panel top + header height (so we don't cover the header)
                    topLimit = panelRect.top + headerHeight;
                }
            }

            const availableHeight = bottomY - topLimit;
            // Ensure we have at least min-height space
            const finalAvailableHeight = Math.max(150, availableHeight);
            // Limit to 600px max (usability cap) OR available height
            const maxHeight = Math.min(600, finalAvailableHeight);

            const newHeight = Math.max(150, Math.min(startHeight + deltaY, maxHeight));

            container.style.width = `${newWidth}px`;
            container.style.height = `${newHeight}px`;
        };

        const onMouseUp = () => {
            // Save size for next time
            FloatingInput.savedWidth = container.offsetWidth;
            FloatingInput.savedHeight = container.offsetHeight;
            logger.debug('[FloatingInput] Size saved:', { width: FloatingInput.savedWidth, height: FloatingInput.savedHeight });

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startY = e.clientY;
            startWidth = container.offsetWidth;
            startHeight = container.offsetHeight;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
}
