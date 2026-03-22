import { Icons } from '../../../../../assets/icons';
import { t } from '../../../components/i18n';

export type SponsorTabViewActions = {
    githubUrl: string;
    getAssetUrl: (assetPath: string) => string;
};

export class SponsorTabView {
    private root: HTMLElement;

    constructor(params: { actions: SponsorTabViewActions }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-sponsor';

        const celebration = document.createElement('div');
        celebration.className = 'sponsor-celebration';
        celebration.setAttribute('aria-hidden', 'true');

        const shell = document.createElement('div');
        shell.className = 'sponsor-shell';

        const brandRow = document.createElement('div');
        brandRow.className = 'sponsor-title-row';
        const brandBadge = document.createElement('div');
        brandBadge.className = 'sponsor-brand-badge';
        const brandMark = document.createElement('img');
        brandMark.className = 'sponsor-brand-mark';
        brandMark.src = params.actions.getAssetUrl('icons/icon128.png');
        brandMark.alt = 'AI-MarkDone';
        brandBadge.appendChild(brandMark);
        brandRow.appendChild(brandBadge);

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
              href="${params.actions.githubUrl}"
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
        const bmc = params.actions.getAssetUrl('icons/bmc_qr.png');
        const wechat = params.actions.getAssetUrl('icons/wechat_qr.png');
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

        shell.append(brandRow, openSource, donate);
        this.root.append(celebration, shell);
    }

    getElement(): HTMLElement {
        return this.root;
    }
}
