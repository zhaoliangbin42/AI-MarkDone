import { createSupportContactCard } from './supportContactCard';
import { createWebsiteCard } from './websiteCard';
import { t } from '../../../components/i18n';

export type FeedbackTabViewActions = {
    getAssetUrl: (assetPath: string) => string;
    showCommunityCards?: boolean;
};

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

type CommunityGroupCard = {
    platform: string;
    meta: string;
    hint: string;
    imagePath: string;
    imageAlt: string;
};

function createCommunityGroupCard(actions: FeedbackTabViewActions): HTMLElement {
    const section = document.createElement('section');
    section.className = 'community-card';

    const header = document.createElement('div');
    header.className = 'community-card__header';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'community-card__eyebrow';
    eyebrow.textContent = tr('communityCardEyebrow', 'Scan to join');

    const title = document.createElement('h4');
    title.className = 'community-card__title';
    title.textContent = tr('communityCardTitle', 'Join the AI-MarkDone community');

    const description = document.createElement('p');
    description.className = 'community-card__description';
    description.textContent = tr(
        'communityCardDesc',
        'Join a group to share feedback, report issues, and compare workflows with other AI-MarkDone users.',
    );
    header.append(eyebrow, title, description);

    const groups: CommunityGroupCard[] = [
        {
            platform: tr('communityQQTitle', 'QQ group'),
            meta: tr('communityQQMeta', 'Group 962705835'),
            hint: tr('communityQQHint', 'Open QQ and scan the code to join.'),
            imagePath: 'icons/qq-group-invite.png',
            imageAlt: tr('communityQQAlt', 'AI-MarkDone QQ group invite QR code, group 962705835'),
        },
        {
            platform: tr('communityXiaohongshuTitle', 'Xiaohongshu group'),
            meta: tr('communityXiaohongshuMeta', 'Invite valid through August 14, 2026'),
            hint: tr(
                'communityXiaohongshuHint',
                'Open Xiaohongshu and scan the code. If it has expired, follow my Xiaohongshu account and join the group through my profile.',
            ),
            imagePath: 'icons/xiaohongshu-group-invite.png',
            imageAlt: tr('communityXiaohongshuAlt', 'AI-MarkDone Xiaohongshu group invite QR code'),
        },
    ];

    const grid = document.createElement('div');
    grid.className = 'community-group-grid';
    for (const group of groups) {
        const card = document.createElement('article');
        card.className = 'community-group-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'community-group-card__header';

        const platform = document.createElement('strong');
        platform.className = 'community-group-card__platform';
        platform.textContent = group.platform;

        const meta = document.createElement('span');
        meta.className = 'community-group-card__meta';
        meta.textContent = group.meta;
        cardHeader.append(platform, meta);

        const figure = document.createElement('figure');
        figure.className = 'community-group-card__figure';

        const imageFrame = document.createElement('div');
        imageFrame.className = 'community-group-card__image-frame';

        const image = document.createElement('img');
        image.className = 'community-group-card__image';
        image.src = actions.getAssetUrl(group.imagePath);
        image.alt = group.imageAlt;
        image.loading = 'lazy';
        image.decoding = 'async';
        imageFrame.appendChild(image);

        const caption = document.createElement('figcaption');
        caption.className = 'community-group-card__hint';
        caption.textContent = group.hint;
        figure.append(imageFrame, caption);
        card.append(cardHeader, figure);
        grid.appendChild(card);
    }

    const privacyNote = document.createElement('p');
    privacyNote.className = 'community-card__privacy-note';
    privacyNote.textContent = tr(
        'communityPrivacyNote',
        'Joining is optional and group members may see your public profile. You can also follow my Xiaohongshu account and enter the group through my profile.',
    );

    section.append(header, grid, privacyNote);
    return section;
}

export class FeedbackTabView {
    private root: HTMLElement;

    constructor(params: { actions: FeedbackTabViewActions }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-feedback';
        this.render(params.actions);
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(actions: FeedbackTabViewActions): void {
        const shell = document.createElement('div');
        shell.className = 'info-shell feedback-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--feedback';
        hero.innerHTML = `
          <div class="info-eyebrow">${tr('feedbackHeroEyebrow', 'Community and support')}</div>
          <h3 class="info-hero__title">${tr('feedbackHeroTitle', 'Help shape AI-MarkDone')}</h3>
          <p class="info-hero__body">${tr(
              'feedbackHeroDesc',
              'Share what works, what gets in your way, and what would make the extension more useful in your daily workflow.',
          )}</p>
        `;

        shell.appendChild(hero);
        if (actions.showCommunityCards !== false) {
            shell.appendChild(createCommunityGroupCard(actions));
        }
        shell.append(createSupportContactCard(), createWebsiteCard());
        this.root.replaceChildren(shell);
    }
}
