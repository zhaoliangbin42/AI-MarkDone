/**
 * Button Component
 * 
 * A reusable button component with multiple variants and sizes.
 * Uses design tokens for consistent styling.
 * 
 * @example
 * ```typescript
 * const button = new Button({
 *   text: 'Save',
 *   variant: 'primary',
 *   size: 'md',
 *   icon: Icons.check,
 *   onClick: () => console.log('Clicked!')
 * });
 * 
 * container.appendChild(button.render());
 * ```
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
    text: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: string;
    iconPosition?: 'left' | 'right';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    type?: 'button' | 'submit' | 'reset';
    className?: string;
    onClick?: (e: MouseEvent) => void;
}

export class Button {
    private props: ButtonProps;
    private element: HTMLButtonElement | null = null;

    constructor(props: ButtonProps) {
        this.props = {
            variant: 'secondary',
            size: 'md',
            iconPosition: 'left',
            disabled: false,
            loading: false,
            fullWidth: false,
            type: 'button',
            ...props,
        };
    }

    /**
     * Render button element
     */
    render(): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = this.props.type!;
        button.className = this.getClassName();
        button.disabled = this.props.disabled || this.props.loading || false;

        // Add content
        button.innerHTML = this.getContent();

        // Bind click handler
        if (this.props.onClick && !this.props.disabled && !this.props.loading) {
            button.addEventListener('click', this.props.onClick);
        }

        this.element = button;
        return button;
    }

    /**
     * Get button class name
     */
    private getClassName(): string {
        const classes = ['btn'];

        // Variant
        classes.push(`btn-${this.props.variant}`);

        // Size
        classes.push(`btn-${this.props.size}`);

        // States
        if (this.props.loading) classes.push('btn-loading');
        if (this.props.fullWidth) classes.push('btn-full-width');
        if (this.props.icon && !this.props.text) classes.push('btn-icon-only');

        // Custom class
        if (this.props.className) classes.push(this.props.className);

        return classes.join(' ');
    }

    /**
     * Get button content
     */
    private getContent(): string {
        if (this.props.loading) {
            return `
        <span class="btn-spinner"></span>
        <span class="btn-text">Loading...</span>
      `;
        }

        const hasIcon = !!this.props.icon;
        const hasText = !!this.props.text;
        const iconLeft = this.props.iconPosition === 'left';

        let content = '';

        if (hasIcon && iconLeft) {
            content += `<span class="btn-icon">${this.props.icon}</span>`;
        }

        if (hasText) {
            content += `<span class="btn-text">${this.escapeHtml(this.props.text)}</span>`;
        }

        if (hasIcon && !iconLeft) {
            content += `<span class="btn-icon">${this.props.icon}</span>`;
        }

        return content;
    }

    /**
     * Update button props
     */
    updateProps(props: Partial<ButtonProps>): void {
        this.props = { ...this.props, ...props };
        if (this.element) {
            this.element.className = this.getClassName();
            this.element.innerHTML = this.getContent();
            this.element.disabled = this.props.disabled || this.props.loading || false;
        }
    }

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
        this.updateProps({ loading });
    }

    /**
     * Set disabled state
     */
    setDisabled(disabled: boolean): void {
        this.updateProps({ disabled });
    }

    /**
     * Escape HTML
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get button styles (for Shadow DOM)
     */
    static getStyles(): string {
        return `
      /* Button Base */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--aimd-space-2);
        font-family: var(--aimd-font-sans);
        font-weight: var(--aimd-font-medium);
        border: none;
        border-radius: var(--aimd-radius-sm);
        cursor: pointer;
        transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
        user-select: none;
        white-space: nowrap;
        text-decoration: none;
      }

      .btn:focus {
        outline: 2px solid var(--aimd-color-blue-500);
        outline-offset: 2px;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Sizes */
      .btn-sm {
        padding: var(--aimd-space-1) var(--aimd-space-3);
        font-size: var(--aimd-text-sm);
        height: 32px;
      }

      .btn-md {
        padding: var(--aimd-space-2) var(--aimd-space-4);
        font-size: var(--aimd-text-base);
        height: 40px;
      }

      .btn-lg {
        padding: var(--aimd-space-3) var(--aimd-space-6);
        font-size: var(--aimd-text-lg);
        height: 48px;
      }

      /* Icon only */
      .btn-icon-only.btn-sm {
        width: 32px;
        padding: var(--aimd-space-1);
      }

      .btn-icon-only.btn-md {
        width: 40px;
        padding: var(--aimd-space-2);
      }

      .btn-icon-only.btn-lg {
        width: 48px;
        padding: var(--aimd-space-3);
      }

      /* Variants */
      .btn-primary {
        background: var(--aimd-interactive-primary);
        color: var(--aimd-text-on-primary);
      }

      .btn-primary:hover:not(:disabled) {
        background: var(--aimd-interactive-primary-hover);
      }

      .btn-primary:active:not(:disabled) {
        background: var(--aimd-interactive-primary-active);
      }

      .btn-secondary {
        background: var(--aimd-color-gray-100);
        color: var(--aimd-color-gray-700);
      }

      .btn-secondary:hover:not(:disabled) {
        background: var(--aimd-color-gray-200);
        color: var(--aimd-color-gray-900);
      }

      .btn-secondary:active:not(:disabled) {
        background: var(--aimd-color-gray-300);
      }

      .btn-ghost {
        background: transparent;
        color: var(--aimd-color-gray-700);
      }

      .btn-ghost:hover:not(:disabled) {
        background: var(--aimd-color-gray-100);
        color: var(--aimd-color-gray-900);
      }

      .btn-ghost:active:not(:disabled) {
        background: var(--aimd-color-gray-200);
      }

      .btn-danger {
        background: var(--aimd-interactive-danger);
        color: var(--aimd-text-on-primary);
      }

      .btn-danger:hover:not(:disabled) {
        background: var(--aimd-interactive-danger-hover);
      }

      .btn-danger:active:not(:disabled) {
        background: var(--aimd-color-red-800);
      }

      /* Full width */
      .btn-full-width {
        width: 100%;
      }

      /* Loading state */
      .btn-loading {
        position: relative;
        color: transparent;
      }

      .btn-spinner {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin var(--aimd-duration-slower) linear infinite;
      }

      @keyframes spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }

      /* Icon */
      .btn-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .btn-icon svg {
        width: 20px;
        height: 20px;
      }
    `;
    }
}
