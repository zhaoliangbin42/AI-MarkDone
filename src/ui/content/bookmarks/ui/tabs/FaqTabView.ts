import { chevronDownIcon, chevronUpIcon } from '../../../../../assets/icons';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';

type FaqItem = {
    question: string;
    answer: string;
};

function getFaqItems(): FaqItem[] {
    return [
        {
            question: t('bookmarksFaqQuestion1'),
            answer: t('bookmarksFaqAnswer1'),
        },
        {
            question: t('bookmarksFaqQuestion2'),
            answer: t('bookmarksFaqAnswer2'),
        },
        {
            question: t('bookmarksFaqQuestion3'),
            answer: t('bookmarksFaqAnswer3'),
        },
        {
            question: t('bookmarksFaqQuestion4'),
            answer: t('bookmarksFaqAnswer4'),
        },
        {
            question: t('bookmarksFaqQuestion5'),
            answer: t('bookmarksFaqAnswer5'),
        },
    ];
}

export class FaqTabView {
    private root: HTMLElement;

    constructor() {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-faq';
        this.render();
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(): void {
        const shell = document.createElement('div');
        shell.className = 'info-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--faq';
        hero.innerHTML = `
          <div class="info-eyebrow">${t('bookmarksFaqEyebrow')}</div>
          <h3 class="info-hero__title">${t('bookmarksFaqTitle')}</h3>
          <p class="info-hero__body">${t('bookmarksFaqIntro')}</p>
        `;

        const section = document.createElement('section');
        section.className = 'info-section';
        section.innerHTML = `
          <div class="info-section__head">
            <div class="info-section__title">${t('bookmarksFaqSectionTitle')}</div>
            <p class="info-section__intro">${t('bookmarksFaqSectionIntro')}</p>
          </div>
        `;

        const list = document.createElement('div');
        list.className = 'info-disclosure-list';

        getFaqItems().forEach((item, index) => {
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
            const paragraph = document.createElement('p');
            paragraph.className = 'info-copy';
            paragraph.textContent = item.answer;
            body.appendChild(paragraph);

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
