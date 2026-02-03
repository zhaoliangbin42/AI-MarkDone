/**
 * Input Component
 * 
 * A reusable input component with validation and icons.
 * Uses design tokens for consistent styling.
 * 
 * @example
 * ```typescript
 * const input = new Input({
 *   type: 'text',
 *   placeholder: 'Enter your name...',
 *   icon: Icons.search,
 *   onChange: (value) => {}
 * });
 * 
 * container.appendChild(input.render());
 * ```
 */

export type InputType = 'text' | 'email' | 'password' | 'search' | 'number' | 'url';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps {
    type?: InputType;
    value?: string;
    placeholder?: string;
    size?: InputSize;
    icon?: string;
    iconPosition?: 'left' | 'right';
    error?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    fullWidth?: boolean;
    className?: string;
    onChange?: (value: string, event: Event) => void;
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
}

export class Input {
    private props: InputProps;
    private container: HTMLDivElement | null = null;
    private input: HTMLInputElement | null = null;
    private errorElement: HTMLDivElement | null = null;

    constructor(props: InputProps) {
        this.props = {
            type: 'text',
            size: 'md',
            iconPosition: 'left',
            disabled: false,
            readonly: false,
            required: false,
            fullWidth: false,
            ...props,
        };
    }

    /**
     * Render input element
     */
    render(): HTMLDivElement {
        const container = document.createElement('div');
        container.className = this.getContainerClassName();

        // Input wrapper (for icon positioning)
        const wrapper = document.createElement('div');
        wrapper.className = 'input-wrapper';

        // Icon (left)
        if (this.props.icon && this.props.iconPosition === 'left') {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'input-icon input-icon-left';
            iconSpan.innerHTML = this.props.icon;
            wrapper.appendChild(iconSpan);
        }

        // Input element
        const input = document.createElement('input');
        input.type = this.props.type!;
        input.className = this.getInputClassName();
        input.placeholder = this.props.placeholder || '';
        input.value = this.props.value || '';
        input.disabled = this.props.disabled || false;
        input.readOnly = this.props.readonly || false;
        input.required = this.props.required || false;

        if (this.props.maxLength) input.maxLength = this.props.maxLength;
        if (this.props.minLength) input.minLength = this.props.minLength;
        if (this.props.pattern) input.pattern = this.props.pattern;

        // Event listeners
        if (this.props.onChange) {
            input.addEventListener('input', (e) => {
                this.props.onChange!(input.value, e);
            });
        }

        if (this.props.onFocus) {
            input.addEventListener('focus', this.props.onFocus);
        }

        if (this.props.onBlur) {
            input.addEventListener('blur', this.props.onBlur);
        }

        if (this.props.onKeyDown) {
            input.addEventListener('keydown', this.props.onKeyDown);
        }

        wrapper.appendChild(input);
        this.input = input;

        // Icon (right)
        if (this.props.icon && this.props.iconPosition === 'right') {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'input-icon input-icon-right';
            iconSpan.innerHTML = this.props.icon;
            wrapper.appendChild(iconSpan);
        }

        container.appendChild(wrapper);

        // Error message
        if (this.props.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'input-error';
            errorDiv.textContent = this.props.error;
            container.appendChild(errorDiv);
            this.errorElement = errorDiv;
        }

        this.container = container;
        return container;
    }

    /**
     * Get container class name
     */
    private getContainerClassName(): string {
        const classes = ['input-container'];

        if (this.props.fullWidth) classes.push('input-full-width');
        if (this.props.className) classes.push(this.props.className);

        return classes.join(' ');
    }

    /**
     * Get input class name
     */
    private getInputClassName(): string {
        const classes = ['input'];

        // Size
        classes.push(`input-${this.props.size}`);

        // Icon padding
        if (this.props.icon) {
            if (this.props.iconPosition === 'left') {
                classes.push('input-with-icon-left');
            } else {
                classes.push('input-with-icon-right');
            }
        }

        // Error state
        if (this.props.error) classes.push('input-error-state');

        return classes.join(' ');
    }

    /**
     * Get input value
     */
    getValue(): string {
        return this.input?.value || '';
    }

    /**
     * Set input value
     */
    setValue(value: string): void {
        if (this.input) {
            this.input.value = value;
        }
    }

    /**
     * Set error message
     */
    setError(error: string | null): void {
        this.props.error = error || undefined;

        if (this.input) {
            if (error) {
                this.input.classList.add('input-error-state');
            } else {
                this.input.classList.remove('input-error-state');
            }
        }

        if (error) {
            if (!this.errorElement && this.container) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'input-error';
                errorDiv.textContent = error;
                this.container.appendChild(errorDiv);
                this.errorElement = errorDiv;
            } else if (this.errorElement) {
                this.errorElement.textContent = error;
            }
        } else if (this.errorElement) {
            this.errorElement.remove();
            this.errorElement = null;
        }
    }

    /**
     * Focus input
     */
    focus(): void {
        this.input?.focus();
    }

    /**
     * Select input text
     */
    select(): void {
        this.input?.select();
    }

    /**
     * Get input styles (for Shadow DOM)
     */
    static getStyles(): string {
        return `
      /* Input Container */
      .input-container {
        display: inline-block;
      }

      .input-full-width {
        width: 100%;
      }

      .input-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: 100%;
      }

      /* Input Base */
      .input {
        font-family: var(--aimd-font-sans);
        font-size: var(--aimd-text-base);
        color: var(--aimd-text-primary);
        background: var(--aimd-bg-primary);
        border: 2px solid var(--aimd-border-default);
        border-radius: var(--aimd-radius-sm);
        outline: none;
        transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
        width: 100%;
      }

      .input::placeholder {
        color: var(--aimd-text-tertiary);
      }

      .input:focus {
        border-color: var(--aimd-border-focus);
        box-shadow: var(--aimd-shadow-focus);
      }

      .input:disabled {
        background: var(--aimd-bg-secondary);
        color: var(--aimd-text-tertiary);
        cursor: not-allowed;
      }

      .input:read-only {
        background: var(--aimd-bg-secondary);
      }

      /* Sizes */
      .input-sm {
        padding: var(--aimd-space-1) var(--aimd-space-3);
        font-size: var(--aimd-text-sm);
        height: 32px;
      }

      .input-md {
        padding: var(--aimd-space-2) var(--aimd-space-3);
        font-size: var(--aimd-text-base);
        height: 40px;
      }

      .input-lg {
        padding: var(--aimd-space-3) var(--aimd-space-4);
        font-size: var(--aimd-text-lg);
        height: 48px;
      }

      /* With icon */
      .input-with-icon-left {
        padding-left: var(--aimd-space-10);
      }

      .input-with-icon-right {
        padding-right: var(--aimd-space-10);
      }

      /* Icon */
      .input-icon {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--aimd-text-tertiary);
        pointer-events: none;
      }

      .input-icon-left {
        left: var(--aimd-space-3);
      }

      .input-icon-right {
        right: var(--aimd-space-3);
      }

      .input-icon svg {
        width: 20px;
        height: 20px;
      }

      .input:focus ~ .input-icon {
        color: var(--aimd-interactive-primary);
      }

      /* Error state */
      .input-error-state {
        border-color: var(--aimd-interactive-danger);
      }

      .input-error-state:focus {
        border-color: var(--aimd-interactive-danger);
        box-shadow: var(--aimd-shadow-error);
      }

      .input-error {
        margin-top: var(--aimd-space-1);
        font-size: var(--aimd-text-sm);
        color: var(--aimd-interactive-danger);
      }
    `;
    }
}
