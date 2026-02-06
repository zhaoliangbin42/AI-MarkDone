import { modalStyles } from '../../styles/modal.css';
import { copyToClipboard } from '../../utils/dom-utils';
import { DesignTokens } from '../../utils/design-tokens';
import { ThemeManager, Theme } from '../../utils/ThemeManager';

import { i18n } from '../../utils/i18n';
/**
 * Modal component using Shadow DOM
 * Displays Markdown source code in a read-only editor
 */
export class Modal {
    private shadowRoot: ShadowRoot;
    private container: HTMLElement;
    private content: string = '';
    private tokenStyleElement: HTMLStyleElement | null = null;
    private themeUnsubscribe: (() => void) | null = null;
    private currentThemeIsDark: boolean = ThemeManager.getInstance().isDarkMode();

    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'aicopy-modal';
        this.shadowRoot = this.container.attachShadow({ mode: 'open' });

        // Inject styles for token-driven theming
        this.injectStyles();
        this.subscribeTheme();
    }

    /**
     * Inject base styles
     */
    private injectStyles(): void {
        this.tokenStyleElement = document.createElement('style');
        this.shadowRoot.appendChild(this.tokenStyleElement);

        const styleElement = document.createElement('style');
        styleElement.textContent = modalStyles;

        this.shadowRoot.appendChild(styleElement);
        this.setTheme(this.currentThemeIsDark);
    }

    /**
     * Subscribe to host theme updates
     */
    private subscribeTheme(): void {
        const themeManager = ThemeManager.getInstance();
        this.themeUnsubscribe = themeManager.subscribe((theme: Theme) => {
            this.setTheme(theme === 'dark');
        });
    }

    /**
     * Apply theme tokens to the modal shadow root
     */
    private setTheme(isDark: boolean): void {
        this.currentThemeIsDark = isDark;
        if (this.tokenStyleElement) {
            this.tokenStyleElement.textContent = `:host { ${DesignTokens.getCompleteTokens(isDark)} }`;
        }
        this.container.dataset.theme = isDark ? 'dark' : 'light';
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
        if (this.themeUnsubscribe) {
            this.themeUnsubscribe();
            this.themeUnsubscribe = null;
        }
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
      <button class="modal-close" aria-label="${i18n.t('btnClose')}">×</button>
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
      <button class="modal-button" id="close-btn">${i18n.t('btnClose')}</button>
      <button class="modal-button primary" id="copy-btn">${i18n.t('btnCopyText')}</button>
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
                copyBtn.textContent = i18n.t('btnCopied');
                setTimeout(() => {
                    copyBtn.textContent = i18n.t('btnCopyText');
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

        // ESC key to close (use capture phase to execute before other bubbling handlers)
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopImmediatePropagation(); // Prevent ESC from closing parent panels
                e.stopPropagation();
                this.hide();
                document.removeEventListener('keydown', handleEscape, true);
            }
        };
        document.addEventListener('keydown', handleEscape, true);
    }
}
