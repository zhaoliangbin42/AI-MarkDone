import { xIcon } from '../../../assets/icons';
import { createIcon } from './Icon';

export type TaskProgressUpdate = {
    label?: string;
    completed?: number;
    total?: number;
    value?: number | null;
    indeterminate?: boolean;
};

export type TaskProgressPanelOptions = {
    cancelLabel: string;
    onCancel: () => void;
};

export class TaskProgressPanel {
    private readonly root: HTMLElement;
    private readonly label: HTMLElement;
    private readonly fill: HTMLElement;
    private closeTimer: number | null = null;

    constructor(private readonly options: TaskProgressPanelOptions) {
        this.root = document.createElement('div');
        this.root.className = 'task-progress';
        this.root.dataset.role = 'task-progress';
        this.root.dataset.open = '0';
        this.root.dataset.indeterminate = '0';

        const body = document.createElement('div');
        body.className = 'task-progress__body';

        this.label = document.createElement('div');
        this.label.className = 'task-progress__label';
        this.label.dataset.field = 'task-progress-label';

        const track = document.createElement('div');
        track.className = 'task-progress__track';
        track.setAttribute('aria-hidden', 'true');

        this.fill = document.createElement('div');
        this.fill.className = 'task-progress__fill';
        this.fill.dataset.field = 'task-progress-fill';
        track.appendChild(this.fill);
        body.append(this.label, track);

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'task-progress__cancel';
        cancel.dataset.action = 'cancel-task';
        cancel.dataset.tooltip = this.options.cancelLabel;
        cancel.setAttribute('aria-label', this.options.cancelLabel);
        cancel.appendChild(createIcon(xIcon));
        cancel.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.options.onCancel();
        });

        this.root.append(body, cancel);
    }

    static getCss(): string {
        return `
.task-progress {
  position: absolute;
  left: 0;
  bottom: calc(100% + var(--aimd-space-2));
  box-sizing: border-box;
  width: 100%;
  min-width: 100%;
  display: none;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2);
  border-radius: var(--aimd-radius-lg);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-surface) 99%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  box-shadow: var(--aimd-shadow-lg);
  z-index: var(--aimd-z-tooltip);
}
.task-progress[data-open="1"] {
  display: flex;
}
.task-progress__body {
  min-width: 0;
  flex: 1 1 auto;
  display: grid;
  gap: var(--aimd-space-1);
}
.task-progress__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  line-height: 1.2;
}
.task-progress__track {
  position: relative;
  height: var(--aimd-space-1);
  overflow: hidden;
  border-radius: var(--aimd-radius-full);
  background: color-mix(in srgb, var(--aimd-border-default) 70%, transparent);
}
.task-progress__fill {
  height: 100%;
  width: 0%;
  border-radius: inherit;
  background: var(--aimd-interactive-primary);
  transition: width var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.task-progress[data-indeterminate="1"] .task-progress__fill {
  animation: taskProgressIndeterminate calc(var(--aimd-duration-base) * 5.5) var(--aimd-ease-in-out) infinite;
}
.task-progress__cancel {
  all: unset;
  box-sizing: border-box;
  flex: 0 0 auto;
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
  border-radius: var(--aimd-radius-lg);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--aimd-button-icon-text);
}
.task-progress__cancel:hover {
  background: var(--aimd-toolbar-hover);
  color: var(--aimd-button-icon-text-hover);
}
.task-progress__cancel:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}
.task-progress__cancel .aimd-icon,
.task-progress__cancel .aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  display: block;
}

@keyframes taskProgressIndeterminate {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(260%); }
}
`;
    }

    getElement(): HTMLElement {
        return this.root;
    }

    open(initial: TaskProgressUpdate): void {
        this.clearCloseTimer();
        this.root.dataset.open = '1';
        this.root.dataset.indeterminate = '0';
        this.fill.style.width = '0%';
        this.update(initial);
    }

    update(event: TaskProgressUpdate): void {
        if (this.root.dataset.open !== '1') return;
        if (event.label) this.label.textContent = event.label;

        const hasRatio = Number.isFinite(event.completed) && Number.isFinite(event.total) && (event.total ?? 0) > 0;
        const explicitValue = typeof event.value === 'number' && Number.isFinite(event.value) ? event.value : null;
        const value = explicitValue ?? (hasRatio ? Math.round(((event.completed ?? 0) / Math.max(1, event.total ?? 1)) * 100) : null);
        const indeterminate = event.indeterminate ?? value === null;
        this.root.dataset.indeterminate = indeterminate ? '1' : '0';
        if (value !== null) {
            this.fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
        } else if (indeterminate) {
            this.fill.style.width = '38%';
        }
    }

    finish(label: string): void {
        this.update({ label, value: 100, indeterminate: false });
        this.clearCloseTimer();
        this.closeTimer = window.setTimeout(() => this.close(), 1200);
    }

    close(): void {
        this.clearCloseTimer();
        this.root.dataset.open = '0';
        this.root.dataset.indeterminate = '0';
    }

    dispose(): void {
        this.close();
    }

    private clearCloseTimer(): void {
        if (this.closeTimer === null) return;
        window.clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }
}
