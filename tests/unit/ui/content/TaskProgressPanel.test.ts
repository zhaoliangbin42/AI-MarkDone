import { describe, expect, it, vi } from 'vitest';
import { TaskProgressPanel } from '@/ui/content/components/TaskProgressPanel';

describe('TaskProgressPanel', () => {
    it('opens, updates determinate progress, and exposes an accessible cancel tooltip', () => {
        const onCancel = vi.fn();
        const host = document.createElement('div');
        document.body.appendChild(host);

        const panel = new TaskProgressPanel({
            cancelLabel: 'Cancel',
            onCancel,
        });
        host.appendChild(panel.getElement());
        panel.open({ label: 'Rendering', completed: 1, total: 4 });

        const element = panel.getElement();
        const label = element.querySelector<HTMLElement>('[data-field="task-progress-label"]')!;
        const fill = element.querySelector<HTMLElement>('[data-field="task-progress-fill"]')!;
        const cancel = element.querySelector<HTMLButtonElement>('[data-action="cancel-task"]')!;

        expect(element.dataset.open).toBe('1');
        expect(element.dataset.indeterminate).toBe('0');
        expect(label.textContent).toBe('Rendering');
        expect(fill.style.width).toBe('25%');
        expect(cancel.getAttribute('aria-label')).toBe('Cancel');
        expect(cancel.dataset.tooltip).toBe('Cancel');

        cancel.click();
        expect(onCancel).toHaveBeenCalledTimes(1);

        panel.dispose();
        host.remove();
    });

    it('supports indeterminate progress, finish auto-close, and dispose cleanup', () => {
        vi.useFakeTimers();
        const panel = new TaskProgressPanel({
            cancelLabel: 'Cancel',
            onCancel: vi.fn(),
        });
        document.body.appendChild(panel.getElement());

        panel.open({ label: 'Preparing', indeterminate: true });
        expect(panel.getElement().dataset.open).toBe('1');
        expect(panel.getElement().dataset.indeterminate).toBe('1');
        expect(panel.getElement().querySelector<HTMLElement>('[data-field="task-progress-fill"]')!.style.width).toBe('38%');

        panel.finish('Done');
        expect(panel.getElement().dataset.open).toBe('1');
        expect(panel.getElement().querySelector<HTMLElement>('[data-field="task-progress-label"]')!.textContent).toBe('Done');
        expect(panel.getElement().querySelector<HTMLElement>('[data-field="task-progress-fill"]')!.style.width).toBe('100%');

        vi.advanceTimersByTime(1200);
        expect(panel.getElement().dataset.open).toBe('0');

        panel.open({ label: 'Again', value: 50 });
        panel.dispose();
        expect(panel.getElement().dataset.open).toBe('0');
        vi.advanceTimersByTime(1200);
        expect(panel.getElement().dataset.open).toBe('0');

        panel.getElement().remove();
        vi.useRealTimers();
    });

    it('keeps visual styling tokenized', () => {
        const css = TaskProgressPanel.getCss();

        expect(css).toContain('var(--aimd-space-2)');
        expect(css).toContain('var(--aimd-radius-lg)');
        expect(css).toContain('var(--aimd-z-tooltip)');
        expect(css).not.toContain('#000');
        expect(css).not.toContain('#fff');
        expect(css).not.toContain('!important');
    });
});
