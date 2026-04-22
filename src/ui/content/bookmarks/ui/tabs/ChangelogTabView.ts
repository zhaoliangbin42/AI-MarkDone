import { chevronDownIcon, chevronUpIcon } from '../../../../../assets/icons';
import { loadParsedChangelogDoc } from '../../content/changelog';
import { createIcon } from '../../../components/Icon';
import { renderInfoBlocks } from './renderInfoBlocks';
import { renderChangelogSections } from './renderChangelogSections';

type ChangelogTabViewParams = {
    resolveAssetUrl?: (assetPath: string) => string;
};

export class ChangelogTabView {
    private root: HTMLElement;
    private resolveAssetUrl?: (assetPath: string) => string;

    constructor(params: ChangelogTabViewParams = {}) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-changelog';
        this.resolveAssetUrl = params.resolveAssetUrl;
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const doc = loadParsedChangelogDoc();
        const shell = document.createElement('div');
        shell.className = 'info-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--timeline';
        hero.innerHTML = `
          <h3 class="info-hero__title">${doc.title}</h3>
        `;

        const section = document.createElement('section');
        section.className = 'info-section';

        const list = document.createElement('div');
        list.className = 'info-disclosure-list';

        doc.entries.forEach((entry, index) => {
            const disclosure = document.createElement('article');
            disclosure.className = 'info-disclosure';
            disclosure.dataset.open = index === 0 ? '1' : '0';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'info-disclosure__trigger';
            button.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');

            const meta = document.createElement('div');
            meta.className = 'info-disclosure__meta';
            meta.innerHTML = `
              <div class="info-disclosure__title">${entry.version}</div>
              <div class="info-disclosure__date">${entry.date}</div>
            `;

            const icon = document.createElement('span');
            icon.className = 'info-disclosure__icon';
            icon.append(createIcon(index === 0 ? chevronUpIcon : chevronDownIcon));

            button.append(meta, icon);

            const body = document.createElement('div');
            body.className = 'info-disclosure__body';
            if (entry.leadBlocks.length > 0) {
                const lead = document.createElement('div');
                lead.className = 'info-disclosure__lead';
                lead.appendChild(renderInfoBlocks(entry.leadBlocks, { resolveAssetUrl: this.resolveAssetUrl }));
                const firstParagraph = lead.querySelector('.info-copy');
                if (firstParagraph) firstParagraph.classList.add('info-disclosure__summary');
                body.appendChild(lead);
            }
            if (entry.sections.length > 0) {
                body.appendChild(renderChangelogSections(entry.sections, { resolveAssetUrl: this.resolveAssetUrl }));
            }

            button.addEventListener('click', () => {
                const nextOpen = disclosure.dataset.open !== '1';
                disclosure.dataset.open = nextOpen ? '1' : '0';
                button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                icon.replaceChildren(createIcon(nextOpen ? chevronUpIcon : chevronDownIcon));
            });

            disclosure.append(button, body);
            list.appendChild(disclosure);
        });

        section.appendChild(list);
        shell.append(hero, section);
        this.root.replaceChildren(shell);
    }
}
