/**
 * Checkbox Component
 * 
 * A custom checkbox component with indeterminate state support.
 * Uses design tokens for consistent styling.
 * 
 * @example
 * ```typescript
 * const checkbox = new Checkbox({
 *   label: 'Accept terms',
 *   checked: false,
 *   onChange: (checked) => {}
 * });
 * 
 * container.appendChild(checkbox.render());
 * ```
 */

import { Icons } from '../assets/icons';

export type CheckboxSize = 'sm' | 'md' | 'lg';

export interface CheckboxProps {
    checked?: boolean;
    indeterminate?: boolean;
    label?: string;
    size?: CheckboxSize;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    onChange?: (checked: boolean, event: Event) => void;
}

export class Checkbox {
    private props: CheckboxProps;
    private container: HTMLLabelElement | null = null;
    private input: HTMLInputElement | null = null;
    private checkmark: HTMLSpanElement | null = null;

    constructor(props: CheckboxProps) {
        this.props = {
            checked: false,
            indeterminate: false,
            size: 'md',
            disabled: false,
            required: false,
            ...props,
        };
    }

    /**
     * Render checkbox element
     */
    render(): HTMLLabelElement {
        const label = document.createElement('label');
        label.className = this.getContainerClassName();

        // Hidden native checkbox
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'checkbox-input';
        input.checked = this.props.checked || false;
        input.disabled = this.props.disabled || false;
        input.required = this.props.required || false;

        // Set indeterminate (must be done via property, not attribute)
        if (this.props.indeterminate) {
            input.indeterminate = true;
        }

        // Event listener
        if (this.props.onChange) {
            input.addEventListener('change', (e) => {
                // Clear indeterminate when user clicks
                if (this.props.indeterminate) {
                    this.setIndeterminate(false);
                }
                this.props.onChange!(input.checked, e);
            });
        }

        label.appendChild(input);
        this.input = input;

        // Custom checkbox visual
        const checkmark = document.createElement('span');
        checkmark.className = this.getCheckmarkClassName();
        checkmark.innerHTML = this.getCheckmarkContent();
        label.appendChild(checkmark);
        this.checkmark = checkmark;

        // Label text
        if (this.props.label) {
            const labelText = document.createElement('span');
            labelText.className = 'checkbox-label';
            labelText.textContent = this.props.label;
            label.appendChild(labelText);
        }

        this.container = label;
        return label;
    }

    /**
     * Get container class name
     */
    private getContainerClassName(): string {
        const classes = ['checkbox-container'];

        classes.push(`checkbox-${this.props.size}`);

        if (this.props.disabled) classes.push('checkbox-disabled');
        if (this.props.className) classes.push(this.props.className);

        return classes.join(' ');
    }

    /**
     * Get checkmark class name
     */
    private getCheckmarkClassName(): string {
        const classes = ['checkbox-checkmark'];

        if (this.props.checked) classes.push('checkbox-checked');
        if (this.props.indeterminate) classes.push('checkbox-indeterminate');

        return classes.join(' ');
    }

    /**
     * Get checkmark content (icon)
     */
    private getCheckmarkContent(): string {
        if (this.props.indeterminate) {
            // Minus icon for indeterminate
            return `<svg viewBox="0 0 16 16" fill="none"><path d="M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
        }
        if (this.props.checked) {
            // Check icon
            return Icons.check;
        }
        return '';
    }

    /**
     * Get checked state
     */
    isChecked(): boolean {
        return this.input?.checked || false;
    }

    /**
     * Set checked state
     */
    setChecked(checked: boolean): void {
        this.props.checked = checked;
        if (this.input) {
            this.input.checked = checked;
        }
        if (this.checkmark) {
            this.checkmark.className = this.getCheckmarkClassName();
            this.checkmark.innerHTML = this.getCheckmarkContent();
        }
        // Clear indeterminate when setting checked
        if (checked && this.props.indeterminate) {
            this.setIndeterminate(false);
        }
    }

    /**
     * Get indeterminate state
     */
    isIndeterminate(): boolean {
        return this.props.indeterminate || false;
    }

    /**
     * Set indeterminate state
     */
    setIndeterminate(indeterminate: boolean): void {
        this.props.indeterminate = indeterminate;
        if (this.input) {
            this.input.indeterminate = indeterminate;
        }
        if (this.checkmark) {
            this.checkmark.className = this.getCheckmarkClassName();
            this.checkmark.innerHTML = this.getCheckmarkContent();
        }
    }

    /**
     * Set disabled state
     */
    setDisabled(disabled: boolean): void {
        this.props.disabled = disabled;
        if (this.input) {
            this.input.disabled = disabled;
        }
        if (this.container) {
            if (disabled) {
                this.container.classList.add('checkbox-disabled');
            } else {
                this.container.classList.remove('checkbox-disabled');
            }
        }
    }

    /**
     * Get checkbox styles (for Shadow DOM)
     */
    static getStyles(): string {
        return `
      /* Checkbox Container */
      .checkbox-container {
        display: inline-flex;
        align-items: center;
        gap: var(--aimd-space-2);
        cursor: pointer;
        user-select: none;
        position: relative;
      }

      .checkbox-disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Hidden native checkbox */
      .checkbox-input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
      }

      /* Custom checkmark */
      .checkbox-checkmark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 2px solid var(--aimd-border-default);
        border-radius: var(--aimd-radius-sm);
        background: var(--aimd-bg-primary);
        transition: all var(--aimd-duration-fast) var(--aimd-ease-in-out);
        color: var(--aimd-text-on-primary);
      }

      /* Sizes */
      .checkbox-sm .checkbox-checkmark {
        width: 16px;
        height: 16px;
      }

      .checkbox-md .checkbox-checkmark {
        width: 20px;
        height: 20px;
      }

      .checkbox-lg .checkbox-checkmark {
        width: 24px;
        height: 24px;
      }

      /* Hover state */
      .checkbox-container:hover:not(.checkbox-disabled) .checkbox-checkmark {
        border-color: var(--aimd-interactive-primary);
      }

      /* Focus state */
      .checkbox-input:focus + .checkbox-checkmark {
        outline: 2px solid var(--aimd-interactive-primary);
        outline-offset: 2px;
      }

      /* Checked state */
      .checkbox-checked {
        background: var(--aimd-interactive-primary);
        border-color: var(--aimd-interactive-primary);
      }

      .checkbox-container:hover:not(.checkbox-disabled) .checkbox-checked {
        background: var(--aimd-interactive-primary-hover);
        border-color: var(--aimd-interactive-primary-hover);
      }

      /* Indeterminate state */
      .checkbox-indeterminate {
        background: var(--aimd-interactive-primary);
        border-color: var(--aimd-interactive-primary);
      }

      /* Icon */
      .checkbox-checkmark svg {
        width: 100%;
        height: 100%;
        padding: 2px;
      }

      /* Label */
      .checkbox-label {
        font-family: var(--aimd-font-sans);
        color: var(--aimd-text-primary);
      }

      .checkbox-sm .checkbox-label {
        font-size: var(--aimd-text-sm);
      }

      .checkbox-md .checkbox-label {
        font-size: var(--aimd-text-base);
      }

      .checkbox-lg .checkbox-label {
        font-size: var(--aimd-text-lg);
      }

      /* Animation */
      @keyframes checkmark-scale {
        0% {
          transform: scale(0);
        }
        50% {
          transform: scale(1.2);
        }
        100% {
          transform: scale(1);
        }
      }

      .checkbox-checked svg,
      .checkbox-indeterminate svg {
        animation: checkmark-scale var(--aimd-duration-base) var(--aimd-ease-bounce);
      }
    `;
    }
}
