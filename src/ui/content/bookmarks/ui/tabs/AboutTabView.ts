import { Icons } from '../../../../../assets/icons';
import { loadBookmarksDoc } from '../../content/loader';
import { parseBookmarksDoc } from '../../content/parser';
import { t } from '../../../components/i18n';
import { renderInfoBlocks } from './renderInfoBlocks';

export type AboutTabViewActions = {
    githubUrl: string;
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
        const storySection = doc.sections[0] ?? { heading: '', blocks: [] };
        const principlesSection = doc.sections[1] ?? { heading: '', blocks: [] };
        const celebration = document.createElement('div');
        celebration.className = 'sponsor-celebration';
        celebration.setAttribute('aria-hidden', 'true');

        const shell = document.createElement('div');
        shell.className = 'info-shell sponsor-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero';

        hero.innerHTML = `
          <h3 class="info-hero__title">${doc.title}</h3>
        `;

        const story = document.createElement('section');
        story.className = 'info-section';
        story.innerHTML = `
          <div class="info-section__head">
            <div class="info-section__title">${storySection.heading}</div>
          </div>
        `;
        const storyCopy = document.createElement('div');
        storyCopy.className = 'info-copy-stack';
        storyCopy.appendChild(renderInfoBlocks(storySection.blocks, { resolveAssetUrl: actions.getAssetUrl }));
        story.appendChild(storyCopy);

        const principles = document.createElement('section');
        principles.className = 'info-section';
        principles.innerHTML = `
          <div class="info-section__head">
            <div class="info-section__title">${principlesSection.heading}</div>
          </div>
        `;
        principles.appendChild(
            renderInfoBlocks(principlesSection.blocks, {
                listClassName: 'info-list info-list--cards',
                listItemClassName: 'info-list-card',
                resolveAssetUrl: actions.getAssetUrl,
            }),
        );

        const openSource = document.createElement('section');
        openSource.className = 'sponsor-card sponsor-card--primary';
        openSource.innerHTML = `
          <div class="sponsor-section-head">
            <div class="sponsor-section-icon">${Icons.github}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">${t('supportDevelopment')}</div>
            </div>
          </div>
          <p class="sponsor-section-body">${t('supportDevDesc')}</p>
          <div class="sponsor-action-row">
            <a
              class="primary-btn sponsor-cta-button"
              data-action="sponsor-github"
              href="${actions.githubUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${Icons.github}
              ${t('starOnGitHub')}
            </a>
          </div>
        `;

        const donate = document.createElement('section');
        donate.className = 'sponsor-card sponsor-card--secondary';
        const bmc = actions.getAssetUrl('icons/bmc_qr.png');
        const wechat = actions.getAssetUrl('icons/wechat_qr.png');
        donate.innerHTML = `
          <div class="sponsor-section-head">
            <div class="sponsor-section-icon sponsor-section-icon--warm">${Icons.coffee}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">${t('ifProjectHelps')}</div>
            </div>
          </div>
          <p class="sponsor-section-body">${t('supportCoffeeDesc')}</p>
          <div class="sponsor-qr-grid">
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>${t('buyMeCoffee')}</strong>
              </div>
              <div class="sponsor-qr-frame">
                <img src="${bmc}" alt="Buy Me A Coffee QR code" class="sponsor-qr-image">
              </div>
            </article>
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>${t('wechatAppreciationCode')}</strong>
              </div>
              <div class="sponsor-qr-frame">
                <img src="${wechat}" alt="WeChat appreciation code" class="sponsor-qr-image">
              </div>
            </article>
          </div>
        `;

        shell.append(hero, story, principles, openSource, donate);
        this.root.replaceChildren(celebration, shell);
    }
}
