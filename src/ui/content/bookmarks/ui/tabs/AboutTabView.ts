import { Icons } from '../../../../../assets/icons';
import { t } from '../../../components/i18n';

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
        const celebration = document.createElement('div');
        celebration.className = 'sponsor-celebration';
        celebration.setAttribute('aria-hidden', 'true');

        const shell = document.createElement('div');
        shell.className = 'info-shell sponsor-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero';

        const brandRow = document.createElement('div');
        brandRow.className = 'sponsor-title-row';
        const brandBadge = document.createElement('div');
        brandBadge.className = 'sponsor-brand-badge';
        const brandMark = document.createElement('img');
        brandMark.className = 'sponsor-brand-mark';
        brandMark.src = actions.getAssetUrl('icons/icon128.png');
        brandMark.alt = 'AI-MarkDone';
        brandBadge.appendChild(brandMark);
        brandRow.appendChild(brandBadge);

        hero.innerHTML = `
          <div class="info-eyebrow">${t('bookmarksAboutEyebrow')}</div>
          <h3 class="info-hero__title">${t('bookmarksAboutTitle')}</h3>
          <p class="info-hero__body">${t('bookmarksAboutIntro')}</p>
        `;
        hero.prepend(brandRow);

        const story = document.createElement('section');
        story.className = 'info-section';
        story.innerHTML = `
          <div class="info-section__head">
            <div class="info-section__title">${t('bookmarksAboutStoryTitle')}</div>
            <p class="info-section__intro">${t('bookmarksAboutStoryIntro')}</p>
          </div>
          <div class="info-copy-stack">
            <p class="info-copy">${t('bookmarksAboutStoryParagraph1')}</p>
            <p class="info-copy">${t('bookmarksAboutStoryParagraph2')}</p>
          </div>
        `;

        const principles = document.createElement('section');
        principles.className = 'info-section';
        principles.innerHTML = `
          <div class="info-section__head">
            <div class="info-section__title">${t('bookmarksAboutPrinciplesTitle')}</div>
            <p class="info-section__intro">${t('bookmarksAboutPrinciplesIntro')}</p>
          </div>
        `;
        const principlesList = document.createElement('ul');
        principlesList.className = 'info-list info-list--cards';
        [
            t('bookmarksAboutPrinciple1'),
            t('bookmarksAboutPrinciple2'),
            t('bookmarksAboutPrinciple3'),
        ].forEach((item) => {
            const li = document.createElement('li');
            li.className = 'info-list-card';
            li.textContent = item;
            principlesList.appendChild(li);
        });
        principles.appendChild(principlesList);

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
