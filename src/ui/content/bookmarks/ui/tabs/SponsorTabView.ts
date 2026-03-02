import { browser } from '../../../../../drivers/shared/browser';
import { Icons } from '../../../../../assets/icons';
import { t } from '../../../components/i18n';

export class SponsorTabView {
    private root: HTMLElement;

    constructor(params: { githubUrl: string }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-sponsor';

        const scroll = document.createElement('div');
        scroll.className = 'aimd-scroll';

        const content = document.createElement('div');
        content.className = 'support-content';

        const openSource = document.createElement('div');
        openSource.className = 'support-section';
        openSource.innerHTML = `
          <h3>${t('supportDevelopment')}</h3>
          <p>${t('supportDevDesc')}</p>
          <a class="primary-btn" href="${params.githubUrl}" target="_blank" rel="noopener noreferrer">
            ${Icons.github}
            ${t('starOnGitHub')}
          </a>
        `;

        const donate = document.createElement('div');
        donate.className = 'support-section';
        const bmc = browser.runtime.getURL('icons/bmc_qr.png');
        const wechat = browser.runtime.getURL('icons/wechat_qr.png');
        donate.innerHTML = `
          <h3>${t('ifProjectHelps')}</h3>
          <p>${t('supportCoffeeDesc')}</p>
          <div class="qr-cards-row">
            <div class="qr-card">
              <a class="qr-card-label-link" href="https://www.buymeacoffee.com/zhaoliangbin" target="_blank" rel="noopener noreferrer">${t('buyMeCoffee')}</a>
              <div class="qr-image-wrapper">
                <img src="${bmc}" alt="Buy Me A Coffee" class="qr-image">
              </div>
            </div>
            <div class="qr-card">
              <span class="qr-card-label">${t('wechatAppreciationCode')}</span>
              <div class="qr-image-wrapper">
                <img src="${wechat}" alt="WeChat Reward" class="qr-image">
              </div>
            </div>
          </div>
        `;

        content.append(openSource, donate);
        scroll.appendChild(content);
        this.root.appendChild(scroll);
    }

    getElement(): HTMLElement {
        return this.root;
    }
}
