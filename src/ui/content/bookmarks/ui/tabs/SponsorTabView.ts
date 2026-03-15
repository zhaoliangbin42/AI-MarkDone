import { browser } from '../../../../../drivers/shared/browser';
import { Icons } from '../../../../../assets/icons';
import { t } from '../../../components/i18n';

export class SponsorTabView {
    private root: HTMLElement;

    constructor(params: { githubUrl: string }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-sponsor';

        const celebration = document.createElement('div');
        celebration.className = 'sponsor-celebration';
        celebration.setAttribute('aria-hidden', 'true');

        const shell = document.createElement('div');
        shell.className = 'sponsor-shell';

        const brandRow = document.createElement('div');
        brandRow.className = 'sponsor-title-row';
        const brandMark = document.createElement('img');
        brandMark.className = 'sponsor-brand-mark';
        brandMark.src = browser.runtime.getURL('icons/icon128.png');
        brandMark.alt = 'AI-MarkDone';
        brandRow.appendChild(brandMark);

        const openSource = document.createElement('section');
        openSource.className = 'sponsor-card sponsor-card--primary';
        openSource.innerHTML = `
          <div class="sponsor-section-head">
            <div class="sponsor-section-icon">${Icons.github}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">${t('supportDevelopment')}</div>
              <div class="sponsor-section-note">${t('supportDevDesc')}</div>
            </div>
          </div>
          <p>${t('ifProjectHelps')}</p>
          <div class="sponsor-action-row">
            <button type="button" class="primary-btn sponsor-cta-button" data-action="sponsor-github">
              ${Icons.github}
              ${t('starOnGitHub')}
            </button>
          </div>
        `;
        openSource.querySelector<HTMLButtonElement>('[data-action="sponsor-github"]')?.addEventListener('click', () => {
            window.open(params.githubUrl, '_blank', 'noopener,noreferrer');
        });

        const donate = document.createElement('section');
        donate.className = 'sponsor-card sponsor-card--secondary';
        const bmc = browser.runtime.getURL('icons/bmc_qr.png');
        const wechat = browser.runtime.getURL('icons/wechat_qr.png');
        donate.innerHTML = `
          <div class="sponsor-section-head sponsor-section-head--centered">
            <div class="sponsor-section-icon sponsor-section-icon--warm">${Icons.coffee}</div>
            <div class="sponsor-section-copy">
              <div class="sponsor-section-label">Donate</div>
              <div class="sponsor-section-note">${t('supportCoffeeDesc')}</div>
            </div>
          </div>
          <p>${t('ifProjectHelps')}</p>
          <div class="sponsor-qr-grid">
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>${t('buyMeCoffee')}</strong>
                <span>${t('supportCoffeeDesc')}</span>
              </div>
              <div class="sponsor-qr-frame">
                <img src="${bmc}" alt="Buy Me A Coffee QR code" class="sponsor-qr-image">
              </div>
            </article>
            <article class="sponsor-qr-card">
              <div class="sponsor-qr-meta">
                <strong>${t('wechatAppreciationCode')}</strong>
                <span>${t('supportDevelopment')}</span>
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
