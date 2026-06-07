import { AI_MARKDONE_HOMEPAGE_URL } from '../../../../../../config/extension/productLinks';
import { externalLinkIcon } from '../../../../../assets/icons';
import { t } from '../../../components/i18n';

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

export function createWebsiteCard(): HTMLElement {
    const card = document.createElement('section');
    card.className = 'about-website-card';

    const content = document.createElement('div');
    content.className = 'about-website-card__content';

    const title = document.createElement('div');
    title.className = 'about-website-card__title';
    title.textContent = tr('aboutWebsiteTitle', 'AI-MarkDone website');

    const copy = document.createElement('p');
    copy.className = 'about-website-card__copy';
    copy.textContent = tr(
        'aboutWebsiteDesc',
        'The website is finally online. Feel free to take a look, and I would be grateful if you shared it with someone who might need AI-MarkDone too.',
    );

    content.append(title, copy);

    const link = document.createElement('a');
    link.className = 'support-contact-card__button about-website-card__button';
    link.href = AI_MARKDONE_HOMEPAGE_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = tr('aboutWebsiteButton', 'Visit website');
    link.insertAdjacentHTML('afterbegin', `<span class="support-contact-card__button-icon" aria-hidden="true">${externalLinkIcon}</span>`);

    card.append(content, link);
    return card;
}
