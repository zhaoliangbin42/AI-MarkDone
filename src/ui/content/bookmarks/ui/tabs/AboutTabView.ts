import { loadBookmarksDoc } from '../../content/loader';
import { parseBookmarksDoc } from '../../content/parser';
import { MAPPAMORY_APP_STORE_URL, MAPPAMORY_X_URL } from '../../../../../../config/extension/productLinks';
import { externalLinkIcon } from '../../../../../assets/icons';
import { getEffectiveLocale, t } from '../../../components/i18n';
import { renderInfoBlocks } from './renderInfoBlocks';
import { TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED } from '../../../../../config/targetSurface';

export type AboutTabViewActions = {
    getAssetUrl: (assetPath: string) => string;
    showSocialFollowCard?: boolean;
};

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

function createMappamoryPromoCard(actions: AboutTabViewActions): HTMLElement {
    const isChineseLocale = getEffectiveLocale() === 'zh_CN';
    const card = document.createElement('section');
    card.className = 'mappamory-promo-card';

    const content = document.createElement('div');
    content.className = 'mappamory-promo-card__content';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'mappamory-promo-card__eyebrow';
    eyebrow.textContent = tr('mappamoryPromoEyebrow', 'My iOS app');

    const title = document.createElement('div');
    title.className = 'mappamory-promo-card__title';
    title.textContent = tr('mappamoryPromoTitle', 'Mappamory');

    const copy = document.createElement('p');
    copy.className = 'mappamory-promo-card__copy';
    copy.textContent = tr(
        'mappamoryPromoDesc',
        'A local-first friends map contact book for remembering the hometowns, schools, workplaces, and meaningful places of people you care about.',
    );

    const xLink = document.createElement('a');
    xLink.className = 'mappamory-promo-card__social-link';
    xLink.href = MAPPAMORY_X_URL;
    xLink.target = '_blank';
    xLink.rel = 'noopener noreferrer';
    xLink.textContent = tr('mappamoryPromoXLink', `X: ${MAPPAMORY_X_URL}`);

    const link = document.createElement('a');
    link.className = 'support-contact-card__button support-contact-card__button--email mappamory-promo-card__button';
    link.href = MAPPAMORY_APP_STORE_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = tr('mappamoryPromoButton', 'View on App Store');
    link.insertAdjacentHTML('afterbegin', `<span class="support-contact-card__button-icon" aria-hidden="true">${externalLinkIcon}</span>`);

    content.append(eyebrow, title, copy);
    if (!isChineseLocale) {
        content.appendChild(xLink);
    }
    content.appendChild(link);

    const media = document.createElement('div');
    media.className = 'mappamory-promo-card__media';

    const image = document.createElement('img');
    image.className = 'mappamory-promo-card__image';
    image.src = actions.getAssetUrl(isChineseLocale ? 'icons/mappamory-changelog-4.6.0.png' : 'icons/mappamory-about-en-4.6.0.png');
    image.alt = tr('mappamoryPromoImageAlt', 'Mappamory app preview');
    image.loading = 'lazy';
    media.appendChild(image);

    card.append(content, media);
    return card;
}

export class AboutTabView {
    private root: HTMLElement;

    constructor(params: { actions: AboutTabViewActions }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-about';
        this.render(params.actions);
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(actions: AboutTabViewActions): void {
        const doc = parseBookmarksDoc(loadBookmarksDoc('about'));
        const celebration = document.createElement('div');
        celebration.className = 'sponsor-celebration';
        celebration.setAttribute('aria-hidden', 'true');

        const shell = document.createElement('div');
        shell.className = 'info-shell sponsor-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero';

        const heroTitle = document.createElement('h3');
        heroTitle.className = 'info-hero__title';
        heroTitle.textContent = t('followMe');
        hero.appendChild(heroTitle);

        const profileCard = document.createElement('section');
        profileCard.className = 'info-profile-card';
        profileCard.innerHTML = `
          <div class="info-profile">
            <div class="info-profile__avatar-frame">
              <img src="${actions.getAssetUrl('icons/about_avatar.png')}" alt="Benko Zhao avatar" class="info-profile__avatar">
            </div>
            <p class="info-profile__bio">${t('aboutProfileBio')}</p>
          </div>
        `;

        const infoSections = document.createDocumentFragment();
        for (const section of doc.sections) {
            const container = document.createElement('section');
            container.className = 'info-section';
            container.innerHTML = `
              <div class="info-section__head">
                <div class="info-section__title">${section.heading}</div>
              </div>
            `;

            const body = document.createElement('div');
            body.className = 'info-copy-stack';
            body.appendChild(renderInfoBlocks(section.blocks, { resolveAssetUrl: actions.getAssetUrl }));
            container.appendChild(body);
            infoSections.appendChild(container);
        }

        shell.append(hero, profileCard, createMappamoryPromoCard(actions), infoSections);
        if (TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED && actions.showSocialFollowCard !== false) {
            const socialFollow = document.createElement('section');
            socialFollow.className = 'social-follow-card';
            socialFollow.innerHTML = `
              <div class="sponsor-section-head">
                <div class="sponsor-section-copy">
                  <div class="sponsor-section-label">${t('findMeOnXiaohongshu')}</div>
                </div>
              </div>
              <div class="social-follow-card__frame">
                <img src="${actions.getAssetUrl('icons/xiaohongshu_card.png')}" alt="Xiaohongshu account card" class="social-follow-card__image">
              </div>
            `;
            shell.appendChild(socialFollow);
        }
        this.root.replaceChildren(celebration, shell);
    }

}
