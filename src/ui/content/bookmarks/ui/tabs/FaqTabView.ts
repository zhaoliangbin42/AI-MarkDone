import { chevronDownIcon, chevronUpIcon } from '../../../../../assets/icons';
import { loadBookmarksDoc } from '../../content/loader';
import { parseFaqDoc } from '../../content/parser';
import { createIcon } from '../../../components/Icon';
import { renderInfoBlocks } from './renderInfoBlocks';

type FaqTabViewParams = {
    resolveAssetUrl?: (assetPath: string) => string;
};

export class FaqTabView {
    private root: HTMLElement;
    private resolveAssetUrl?: (assetPath: string) => string;

    constructor(params: FaqTabViewParams = {}) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-faq';
        this.resolveAssetUrl = params.resolveAssetUrl;
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const doc = parseFaqDoc(loadBookmarksDoc('faq'));
        const shell = document.createElement('div');
        shell.className = 'info-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--faq';
        hero.innerHTML = `
          <h3 class="info-hero__title">${doc.title}</h3>
        `;

        const section = document.createElement('section');
        section.className = 'info-section';

        const list = document.createElement('div');
        list.className = 'info-disclosure-list';

        doc.items.forEach((item, index) => {
            const disclosure = document.createElement('article');
            disclosure.className = 'info-disclosure';
            disclosure.dataset.open = index === 0 ? '1' : '0';

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'info-disclosure__trigger';
            trigger.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');

            const title = document.createElement('div');
            title.className = 'info-disclosure__title info-disclosure__title--single';
            title.textContent = item.question;

            const icon = document.createElement('span');
            icon.className = 'info-disclosure__icon';
            icon.append(createIcon(index === 0 ? chevronUpIcon : chevronDownIcon));

            trigger.append(title, icon);

            const body = document.createElement('div');
            body.className = 'info-disclosure__body';
            body.appendChild(renderInfoBlocks(item.blocks, { resolveAssetUrl: this.resolveAssetUrl }));

            trigger.addEventListener('click', () => {
                const nextOpen = disclosure.dataset.open !== '1';
                disclosure.dataset.open = nextOpen ? '1' : '0';
                trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                icon.replaceChildren(createIcon(nextOpen ? chevronUpIcon : chevronDownIcon));
            });

            disclosure.append(trigger, body);
            list.appendChild(disclosure);
        });

        section.appendChild(list);
        shell.append(hero, section);
        this.root.replaceChildren(shell);
    }
}
