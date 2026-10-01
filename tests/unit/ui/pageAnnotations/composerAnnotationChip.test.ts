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

    it('renders beside the official composer action container and hides at zero', () => {
        const { container, anchor } = mountComposer();

        const chip = new ComposerAnnotationChip(createAppearanceSnapshot('light'));
        chip.render({ container, anchor }, 3, handlers());

        const host = container.querySelector<HTMLElement>('[data-aimd-role="page-annotation-composer-chip"]')!;
        expect(host).toBeTruthy();
        expect(host.previousElementSibling).toBe(anchor);
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

    it('does not move an already positioned chip during an identical render', async () => {
        const { container, anchor } = mountComposer();

        const chip = new ComposerAnnotationChip(createAppearanceSnapshot('light'));
        chip.render({ container, anchor }, 2, handlers());
        await Promise.resolve();

        const host = container.querySelector<HTMLElement>('[data-aimd-role="page-annotation-composer-chip"]')!;
        const observer = new MutationObserver(vi.fn());
        observer.observe(container, { childList: true });

        chip.render({ container, anchor }, 2, handlers());
        const records = observer.takeRecords();

        expect(records).toHaveLength(0);
        expect(container.querySelector('[data-aimd-role="page-annotation-composer-chip"]')).toBe(host);
        expect(host.previousElementSibling).toBe(anchor);
        observer.disconnect();
        chip.dispose();
    });
});

it('does not reorder the two entry hosts when their owners refresh unchanged values', () => {
    const container=document.createElement('div');const official=document.createElement('span');container.append(official);document.body.append(container);
    const first=new ComposerAnnotationChip(createAppearanceSnapshot('light'));const second=new ComposerAnnotationChip(createAppearanceSnapshot('light'),{role:'composer-input-enhancement-chip',showCount:false});const mount={container,anchor:official,officialContainer:official};const handlers={label:'Entry',onOpenManager:()=>undefined};
    first.render(mount,1,handlers);second.render(mount,1,handlers);const order=Array.from(container.children);const observer=new MutationObserver(()=>undefined);observer.observe(container,{childList:true});first.render(mount,1,handlers);second.render(mount,1,handlers);expect(Array.from(container.children)).toEqual(order);expect(observer.takeRecords()).toHaveLength(0);observer.disconnect();first.dispose();second.dispose();container.remove();
});
