import { chevronDownIcon, chevronUpIcon } from '../../../../../assets/icons';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';

type ChangelogEntry = {
    version: string;
    date: string;
    highlights: string[];
    expanded?: boolean;
};

function getChangelogEntries(): ChangelogEntry[] {
    return [
        {
            version: 'Unreleased',
            date: t('bookmarksChangelogDateUnreleased'),
            highlights: [
                t('bookmarksChangelogUnreleasedItem1'),
                t('bookmarksChangelogUnreleasedItem2'),
                t('bookmarksChangelogUnreleasedItem3'),
            ],
            expanded: true,
        },
        {
            version: '4.0.0',
            date: '2026-04-02',
            highlights: [
                t('bookmarksChangelog400Item1'),
                t('bookmarksChangelog400Item2'),
                t('bookmarksChangelog400Item3'),
            ],
        },
        {
            version: '3.0.0',
            date: '2026-02-18',
            highlights: [
                t('bookmarksChangelog300Item1'),
                t('bookmarksChangelog300Item2'),
                t('bookmarksChangelog300Item3'),
            ],
        },
    ];
}

export class ChangelogTabView {
    private root: HTMLElement;

    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-changelog';
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const shell = document.createElement('div');
        shell.className = 'info-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--timeline';
        hero.innerHTML = `
          <div class="info-eyebrow">${t('bookmarksChangelogEyebrow')}</div>
          <h3 class="info-hero__title">${t('bookmarksChangelogTitle')}</h3>
          <p class="info-hero__body">${t('bookmarksChangelogIntro')}</p>
        `;

        const section = document.createElement('section');
        section.className = 'info-section';

        const sectionHead = document.createElement('div');
        sectionHead.className = 'info-section__head';
        sectionHead.innerHTML = `
          <div class="info-section__title">${t('bookmarksChangelogSectionTitle')}</div>
          <p class="info-section__intro">${t('bookmarksChangelogSectionIntro')}</p>
        `;
        section.appendChild(sectionHead);

        const list = document.createElement('div');
        list.className = 'info-disclosure-list';

        for (const entry of getChangelogEntries()) {
            const disclosure = document.createElement('article');
            disclosure.className = 'info-disclosure';
            disclosure.dataset.open = entry.expanded ? '1' : '0';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'info-disclosure__trigger';
            button.setAttribute('aria-expanded', entry.expanded ? 'true' : 'false');

            const meta = document.createElement('div');
            meta.className = 'info-disclosure__meta';
            meta.innerHTML = `
              <div class="info-disclosure__title">${entry.version}</div>
              <div class="info-disclosure__date">${entry.date}</div>
            `;

            const icon = document.createElement('span');
            icon.className = 'info-disclosure__icon';
            icon.append(createIcon(entry.expanded ? chevronUpIcon : chevronDownIcon));

            button.append(meta, icon);

            const body = document.createElement('div');
            body.className = 'info-disclosure__body';
            const bullets = document.createElement('ul');
            bullets.className = 'info-list';
            for (const item of entry.highlights) {
                const li = document.createElement('li');
                li.textContent = item;
                bullets.appendChild(li);
            }
            body.appendChild(bullets);

            button.addEventListener('click', () => {
                const nextOpen = disclosure.dataset.open !== '1';
                disclosure.dataset.open = nextOpen ? '1' : '0';
                button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
                icon.replaceChildren(createIcon(nextOpen ? chevronUpIcon : chevronDownIcon));
            });

            disclosure.append(button, body);
            list.appendChild(disclosure);
        }

        section.appendChild(list);
        shell.append(hero, section);
        this.root.replaceChildren(shell);
    }
}
