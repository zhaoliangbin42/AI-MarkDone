import { loadBookmarksDoc } from '../../content/loader';
import { parseBookmarksDoc } from '../../content/parser';
import { t } from '../../../components/i18n';
import { renderInfoBlocks } from './renderInfoBlocks';

export type AboutTabViewActions = {
    getAssetUrl: (assetPath: string) => string;
};

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

        shell.append(hero, profileCard, infoSections, socialFollow);
        this.root.replaceChildren(celebration, shell);
    }
}
