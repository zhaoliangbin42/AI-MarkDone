import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposerAnnotationChip } from '@/ui/content/pageAnnotations/ComposerAnnotationChip';
import { createAppearanceSnapshot } from '@/style/appearance';

function mountComposer(): { form: HTMLElement; container: HTMLElement; anchor: HTMLElement; composer: HTMLElement } {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="container-parent">
        <div class="official-container"><button data-testid="composer-plus-btn"></button></div>
      </div>
      <div contenteditable="true"></div>
    `;
    document.body.appendChild(form);
    const composer = form.querySelector<HTMLElement>('[contenteditable="true"]')!;
    const officialContainer = form.querySelector<HTMLElement>('.official-container')!;
    const container = officialContainer.parentElement!;
    return { form, container, anchor: officialContainer, composer };
}

function handlers() {
    return {
        onOpenManager: vi.fn(),
        label: 'Open current-conversation annotations',
    };
}

describe('ComposerAnnotationChip', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders beside the enhancement button with the annotation count and hides at zero', () => {
        const { container, anchor } = mountComposer();
        const enhancementHost = document.createElement('span');
        enhancementHost.dataset.aimdRole = 'input-enhancement-button';
        container.appendChild(enhancementHost);

        const chip = new ComposerAnnotationChip(createAppearanceSnapshot('light'));
        chip.render({ container, anchor }, 3, handlers());

        const host = container.querySelector<HTMLElement>('[data-aimd-role="page-annotation-composer-chip"]')!;
        expect(host).toBeTruthy();
        expect(host.previousElementSibling).toBe(enhancementHost);
        expect(host.shadowRoot!.querySelector('.chip-count')!.textContent).toBe('3');
        const button = host.shadowRoot!.querySelector<HTMLButtonElement>('.chip-button');
        expect(button?.getAttribute('aria-label')).toBe('Open current-conversation annotations');
        expect(button?.getAttribute('title')).toBe('Open current-conversation annotations');

        chip.render({ container, anchor }, 0, handlers());
        expect(container.querySelector('[data-aimd-role="page-annotation-composer-chip"]')).toBeNull();
        chip.dispose();
    });

    it('opens the manager on chip click', () => {
        const { container, anchor } = mountComposer();
        const chip = new ComposerAnnotationChip(createAppearanceSnapshot('light'));
        const actions = handlers();
        chip.render({ container, anchor }, 1, actions);

        const host = container.querySelector<HTMLElement>('[data-aimd-role="page-annotation-composer-chip"]')!;
        host.shadowRoot!.querySelector<HTMLButtonElement>('.chip-button')!.click();
        expect(actions.onOpenManager).toHaveBeenCalledTimes(1);
        chip.dispose();
    });
});
