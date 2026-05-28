import { loadBookmarksDoc } from '../../content/loader';
import { parseBookmarksDoc } from '../../content/parser';
import { t } from '../../../components/i18n';
import { renderInfoBlocks } from './renderInfoBlocks';
import { TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED } from '../../../../../config/targetSurface';
import { copyIcon, externalLinkIcon } from '../../../../../assets/icons';
import { copyTextToClipboard } from '../../../../../drivers/content/clipboard/clipboard';

const SUPPORT_EMAIL = 'zhaoliangbin42@gmail.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=AI-MarkDone%20Safari%20Feedback`;

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

export type AboutTabViewActions = {
    getAssetUrl: (assetPath: string) => string;
    showSocialFollowCard?: boolean;
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

        shell.append(hero, profileCard, this.createSupportContactCard(), infoSections);
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

    private createSupportContactCard(): HTMLElement {
        const card = document.createElement('section');
        card.className = 'support-contact-card';

        const content = document.createElement('div');
        content.className = 'support-contact-card__content';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'support-contact-card__eyebrow';
        eyebrow.textContent = tr('supportContactEyebrow', 'Support');

        const title = document.createElement('div');
        title.className = 'support-contact-card__title';
        title.textContent = tr('supportContactTitle', 'Need help or want to share feedback?');

        const copy = document.createElement('p');
        copy.className = 'support-contact-card__copy';
        copy.textContent = tr(
            'supportContactDesc',
            'Send bug reports, workflow notes, and feature ideas by email. Please avoid private conversation content unless it is needed for debugging.',
        );

        const email = document.createElement('div');
        email.className = 'support-contact-card__email';
        email.textContent = SUPPORT_EMAIL;

        content.append(eyebrow, title, copy, email);

        const actions = document.createElement('div');
        actions.className = 'support-contact-card__actions';

        const emailLink = document.createElement('a');
        emailLink.className = 'support-contact-card__button support-contact-card__button--email';
        emailLink.href = SUPPORT_MAILTO;
        emailLink.textContent = tr('supportContactEmail', 'Email Feedback');
        emailLink.insertAdjacentHTML('afterbegin', `<span class="support-contact-card__button-icon" aria-hidden="true">${externalLinkIcon}</span>`);

        const copyButton = document.createElement('button');
        copyButton.className = 'support-contact-card__button support-contact-card__button--copy';
        copyButton.type = 'button';
        copyButton.dataset.action = 'copy-support-email';
        copyButton.textContent = tr('supportContactCopyEmail', 'Copy Email');
        copyButton.insertAdjacentHTML('afterbegin', `<span class="support-contact-card__button-icon" aria-hidden="true">${copyIcon}</span>`);
        copyButton.addEventListener('click', () => void this.copySupportEmail(copyButton));

        actions.append(emailLink, copyButton);
        card.append(content, actions);
        return card;
    }

    private async copySupportEmail(button: HTMLButtonElement): Promise<void> {
        const ok = await copyTextToClipboard(SUPPORT_EMAIL);
        const label = ok ? tr('btnCopied', 'Copied') : tr('clipboardWriteFailed', 'Copy failed');
        const original = tr('supportContactCopyEmail', 'Copy Email');
        const icon = button.querySelector('.support-contact-card__button-icon')?.outerHTML ?? '';
        button.innerHTML = `${icon}${label}`;
        window.setTimeout(() => {
            button.innerHTML = `${icon}${original}`;
        }, 1400);
    }
}
