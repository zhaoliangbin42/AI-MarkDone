import {
    MAPPAMORY_APP_STORE_URL,
    MAPPAMORY_WEBSITE_URL,
} from '../../../../../../config/extension/productLinks';
import { externalLinkIcon } from '../../../../../assets/icons';
import { t } from '../../../components/i18n';

export type MappamoryTabViewActions = {
    getAssetUrl: (assetPath: string) => string;
};

type MappamoryFeature = {
    title: string;
    description: string;
};

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

function createExternalLink(params: {
    href: string;
    label: string;
    variant: 'primary' | 'secondary';
}): HTMLAnchorElement {
    const link = document.createElement('a');
    link.className = `mappamory-cta mappamory-cta--${params.variant}`;
    link.href = params.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const label = document.createElement('span');
    label.textContent = params.label;

    const icon = document.createElement('span');
    icon.className = 'mappamory-cta__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = externalLinkIcon;
    link.append(label, icon);
    return link;
}

function createFeatureRow(feature: MappamoryFeature, index: number): HTMLElement {
    const row = document.createElement('article');
    row.className = 'mappamory-feature';

    const number = document.createElement('span');
    number.className = 'mappamory-feature__number';
    number.textContent = String(index + 1).padStart(2, '0');

    const content = document.createElement('div');
    content.className = 'mappamory-feature__content';

    const title = document.createElement('h4');
    title.className = 'mappamory-feature__title';
    title.textContent = feature.title;

    const description = document.createElement('p');
    description.className = 'mappamory-feature__description';
    description.textContent = feature.description;

    content.append(title, description);
    row.append(number, content);
    return row;
}

export class MappamoryTabView {
    private readonly root: HTMLElement;

    constructor(params: { actions: MappamoryTabViewActions }) {
        this.root = document.createElement('div');
        this.root.className = 'aimd-info-tab aimd-mappamory';
        this.render(params.actions);
    }

    getElement(): HTMLElement {
        return this.root;
    }

    private render(actions: MappamoryTabViewActions): void {
        const shell = document.createElement('div');
        shell.className = 'info-shell mappamory-shell';

        const hero = document.createElement('section');
        hero.className = 'info-hero info-hero--mappamory';

        const eyebrow = document.createElement('div');
        eyebrow.className = 'info-eyebrow';
        eyebrow.textContent = tr('mappamoryHeroEyebrow', 'Mappamory · iPhone app');

        const title = document.createElement('h3');
        title.className = 'info-hero__title';
        title.textContent = tr('mappamoryHeroTitle', 'People, places, and the records that connect them');

        const description = document.createElement('p');
        description.className = 'info-hero__body';
        description.textContent = tr(
            'mappamoryHeroDesc',
            'Mappamory is a map-based contacts app for iPhone. Save the places connected to people you care about, then return through the map or a person’s profile.',
        );

        const actionsRow = document.createElement('div');
        actionsRow.className = 'mappamory-actions';
        actionsRow.append(
            createExternalLink({
                href: MAPPAMORY_APP_STORE_URL,
                label: tr('mappamoryAppStoreButton', 'View on App Store'),
                variant: 'primary',
            }),
            createExternalLink({
                href: MAPPAMORY_WEBSITE_URL,
                label: tr('mappamoryWebsiteButton', 'Visit Mappamory website'),
                variant: 'secondary',
            }),
        );
        hero.append(eyebrow, title, description, actionsRow);

        const poster = document.createElement('figure');
        poster.className = 'mappamory-poster';

        const posterImage = document.createElement('img');
        posterImage.className = 'mappamory-poster__image';
        posterImage.src = actions.getAssetUrl('icons/mappamory-promo-poster.png');
        posterImage.alt = tr('mappamoryPosterAlt', 'Mappamory app poster with a friend map and iPhone preview');
        posterImage.loading = 'eager';
        posterImage.decoding = 'async';
        poster.appendChild(posterImage);

        const story = document.createElement('section');
        story.className = 'mappamory-story';

        const storyHeader = document.createElement('div');
        storyHeader.className = 'mappamory-section-head';

        const storyEyebrow = document.createElement('div');
        storyEyebrow.className = 'mappamory-section-head__eyebrow';
        storyEyebrow.textContent = tr('mappamoryStoryEyebrow', 'A map-based contacts app');

        const storyTitle = document.createElement('h4');
        storyTitle.className = 'mappamory-section-head__title';
        storyTitle.textContent = tr('mappamoryStoryTitle', 'Remember people through the places you share');

        const storyDescription = document.createElement('p');
        storyDescription.className = 'mappamory-section-head__description';
        storyDescription.textContent = tr(
            'mappamoryStoryDesc',
            'Ordinary contacts tell you how to reach someone. Mappamory also helps you remember where your connection happened and what you want to keep from it.',
        );
        storyHeader.append(storyEyebrow, storyTitle, storyDescription);

        const features: MappamoryFeature[] = [
            {
                title: tr('mappamoryFeatureMapTitle', 'See your contacts on a map'),
                description: tr(
                    'mappamoryFeatureMapDesc',
                    'Browse people and places together, then move from an avatar or map cluster into the records behind it.',
                ),
            },
            {
                title: tr('mappamoryFeaturePeopleTitle', 'Return through people or places'),
                description: tr(
                    'mappamoryFeaturePeopleDesc',
                    'Each record connects one or more people with a place, date, notes, tags, and optional photos—so the same memory can be found from either side.',
                ),
            },
            {
                title: tr('mappamoryFeatureLocalTitle', 'Keep your data local by default'),
                description: tr(
                    'mappamoryFeatureLocalDesc',
                    'No account is required. Your data stays on your iPhone by default, with local export, backup, preview, and restore when you need them.',
                ),
            },
        ];

        const featureList = document.createElement('div');
        featureList.className = 'mappamory-feature-list';
        features.forEach((feature, index) => featureList.appendChild(createFeatureRow(feature, index)));
        story.append(storyHeader, featureList);

        const proof = document.createElement('section');
        proof.className = 'mappamory-proof';

        const proofContent = document.createElement('div');
        proofContent.className = 'mappamory-proof__content';

        const proofEyebrow = document.createElement('div');
        proofEyebrow.className = 'mappamory-section-head__eyebrow';
        proofEyebrow.textContent = tr('mappamoryProofEyebrow', 'Inside the app');

        const proofTitle = document.createElement('h4');
        proofTitle.className = 'mappamory-proof__title';
        proofTitle.textContent = tr('mappamoryProofTitle', 'See every record easily on the map');

        const proofDescription = document.createElement('p');
        proofDescription.className = 'mappamory-proof__description';
        proofDescription.textContent = tr(
            'mappamoryProofDesc',
            'Open a place on the map to see the people and records connected to it. Photos, dates, and notes stay with the record instead of being scattered across different apps.',
        );

        const privacy = document.createElement('div');
        privacy.className = 'mappamory-privacy';

        const privacyTitle = document.createElement('strong');
        privacyTitle.className = 'mappamory-privacy__title';
        privacyTitle.textContent = tr('mappamoryPrivacyTitle', 'Save places. Never track people.');

        const privacyDescription = document.createElement('p');
        privacyDescription.className = 'mappamory-privacy__description';
        privacyDescription.textContent = tr(
            'mappamoryPrivacyDesc',
            'Mappamory saves the places you choose for your own records. It is not a live-location service and does not track other people.',
        );
        privacy.append(privacyTitle, privacyDescription);
        proofContent.append(proofEyebrow, proofTitle, proofDescription, privacy);

        const proofMedia = document.createElement('figure');
        proofMedia.className = 'mappamory-proof__media';

        const proofImage = document.createElement('img');
        proofImage.className = 'mappamory-proof__image';
        proofImage.src = actions.getAssetUrl('icons/mappamory-record-map-context.png');
        proofImage.alt = tr('mappamoryProofAlt', 'Mappamory map and record detail screen');
        proofImage.loading = 'lazy';
        proofImage.decoding = 'async';
        proofMedia.appendChild(proofImage);

        proof.append(proofContent, proofMedia);
        shell.append(hero, poster, story, proof);
        this.root.replaceChildren(shell);
    }
}
