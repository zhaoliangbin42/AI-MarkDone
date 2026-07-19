import { loadBookmarksDoc } from '../../content/loader';
import { parseBookmarksDoc } from '../../content/parser';
import { t } from '../../../components/i18n';
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

function decorateStoryPoints(fragment: DocumentFragment): void {
    for (const paragraph of fragment.querySelectorAll<HTMLParagraphElement>('.info-copy')) {
        const match = paragraph.textContent?.match(/^(\d+)\.\s+/);
        if (!match) continue;

        const firstNode = paragraph.firstChild;
        if (firstNode?.nodeType === Node.TEXT_NODE && firstNode.textContent) {
            firstNode.textContent = firstNode.textContent.replace(/^(\d+)\.\s+/, '');
        }
        paragraph.classList.add('info-story-point');
        paragraph.dataset.storyIndex = match[1]!.padStart(2, '0');
    }
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

        const shell = document.createElement('div');
        shell.className = 'info-shell about-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--about';

        const heroEyebrow = document.createElement('div');
        heroEyebrow.className = 'info-eyebrow';
        heroEyebrow.textContent = tr('aboutHeroEyebrow', 'Independent project');

        const heroTitle = document.createElement('h3');
        heroTitle.className = 'info-hero__title';
        heroTitle.textContent = tr('aboutHeroTitle', 'Built from real workflow friction');

        const heroBody = document.createElement('p');
        heroBody.className = 'info-hero__body';
        heroBody.textContent = tr(
            'aboutHeroDesc',
            'AI-MarkDone is a personal project for making long AI conversations easier to read, organize, and reuse.',
        );
        hero.append(heroEyebrow, heroTitle, heroBody);

        const profileCard = document.createElement('section');
        profileCard.className = 'info-profile-card';
        profileCard.innerHTML = `
          <div class="info-profile">
            <div class="info-profile__avatar-frame">
              <img src="${actions.getAssetUrl('icons/about_avatar.png')}" alt="Benko Zhao avatar" class="info-profile__avatar">
            </div>
            <div class="info-profile__content">
              <div class="info-profile__identity">
                <strong class="info-profile__name">Benko Zhao</strong>
                <span class="info-profile__role">${tr('aboutProfileRole', 'Creator of AI-MarkDone')}</span>
              </div>
              <p class="info-profile__bio">${t('aboutProfileBio')}</p>
            </div>
          </div>
        `;

        const infoSections = document.createDocumentFragment();
        for (const section of doc.sections) {
            const container = document.createElement('section');
            container.className = 'info-section info-section--story';
            container.innerHTML = `
              <div class="info-section__head">
                <div class="info-section__title">${section.heading}</div>
              </div>
            `;

            const body = document.createElement('div');
            body.className = 'info-copy-stack';
            const blocks = renderInfoBlocks(section.blocks, {
                listClassName: 'info-list info-list--story',
                listItemClassName: 'info-list-card info-list-card--story',
                resolveAssetUrl: actions.getAssetUrl,
            });
            decorateStoryPoints(blocks);
            body.appendChild(blocks);
            container.appendChild(body);
            infoSections.appendChild(container);
        }

        shell.append(hero, profileCard, infoSections);
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
        this.root.replaceChildren(shell);
    }

}
