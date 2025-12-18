import { modalStyles } from '../../styles/modal.css';
import { copyToClipboard } from '../../utils/dom-utils';
import { DesignTokens } from '../../utils/design-tokens';

/**
 * Modal component using Shadow DOM
 * Displays Markdown source code in a read-only editor
 */
export class Modal {
    private shadowRoot: ShadowRoot;
    private container: HTMLElement;
    private content: string = '';

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'aicopy-modal';
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // ✅ Inject styles with dark mode detection
        this.injectStyles();
    }

    /**
     * Inject styles based on current theme
     */
    private injectStyles(): void {
        const isDark = DesignTokens.isDarkMode();
        const styleElement = document.createElement('style');

        // Add base styles + conditional dark mode class
        styleElement.textContent = modalStyles + `
      ${isDark ? `
        .modal-overlay { background: rgba(0, 0, 0, 0.8); }
        .modal-container { 
          background: #1E1E1E;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.5);
        }
        .modal-header { border-bottom-color: #3F3F46; }
        .modal-title { color: #FFFFFF; }
        .modal-close { color: #A1A1AA; }
        .modal-close:hover { background: #27272A; color: #FFFFFF; }
        .modal-content { background: #1E1E1E; color: #E3E3E3; }
        .modal-footer { border-top-color: #3F3F46; background: #1E1E1E; }
        .modal-button { background: #27272A; color: #E3E3E3; }
        .modal-button:hover { background: #3F3F46; }
        .modal-button.primary { background: #3B82F6; color: white; }
        .modal-button.primary:hover { background: #2563EB; }
      ` : ''}
    `;

        this.shadowRoot.appendChild(styleElement);
    }

    /**
     * Show modal with content
     */
    show(content: string, title: string = 'Markdown Source'): void {
        this.content = content;
        this.createUI(title);
        document.body.appendChild(this.container);
    }

    /**
     * Hide and destroy modal
     */
    hide(): void {
        this.container.remove();
    }

    /**
     * Create modal UI
     */
    private createUI(title: string): void {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'modal-container';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
      <h2 class="modal-title">${title}</h2>
      <button class="modal-close" aria-label="Close">×</button>
    `;

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';

        const contentDiv = document.createElement('pre');
        contentDiv.className = 'modal-content';
        contentDiv.textContent = this.content;

        body.appendChild(contentDiv);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.innerHTML = `
      <button class="modal-button" id="close-btn">Close</button>
      <button class="modal-button primary" id="copy-btn">Copy</button>
    `;

        // Assemble
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // Clear previous content
        this.shadowRoot.innerHTML = '';

        // Re-inject styles with current theme
        this.injectStyles();

        this.shadowRoot.appendChild(overlay);

        // Event listeners
        this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Close button
        const closeBtn = this.shadowRoot.querySelector('#close-btn');
        closeBtn?.addEventListener('click', () => this.hide());

        const closeX = this.shadowRoot.querySelector('.modal-close');
        closeX?.addEventListener('click', () => this.hide());

        // Copy button
        const copyBtn = this.shadowRoot.querySelector('#copy-btn') as HTMLButtonElement;
        copyBtn?.addEventListener('click', async () => {
            const success = await copyToClipboard(this.content);
            if (success) {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            }
        });

        // Click overlay to close
        const overlay = this.shadowRoot.querySelector('.modal-overlay');
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hide();
            }
        });

        // ESC key to close
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.hide();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
}
