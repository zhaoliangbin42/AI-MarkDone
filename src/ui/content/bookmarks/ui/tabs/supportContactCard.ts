import { copyIcon, externalLinkIcon } from '../../../../../assets/icons';
import { copyTextToClipboard } from '../../../../../drivers/content/clipboard/clipboard';
import { t } from '../../../components/i18n';

const SUPPORT_EMAIL = 'zhaoliangbin42@gmail.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=AI-MarkDone%20Safari%20Feedback`;

function tr(key: string, fallback: string): string {
    const value = t(key);
    return value === key ? fallback : value;
}

export function createSupportContactCard(): HTMLElement {
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
    copyButton.addEventListener('click', () => void copySupportEmail(copyButton));

    actions.append(emailLink, copyButton);
    card.append(content, actions);
    return card;
}

async function copySupportEmail(button: HTMLButtonElement): Promise<void> {
    const ok = await copyTextToClipboard(SUPPORT_EMAIL);
    const label = ok ? tr('btnCopied', 'Copied') : tr('clipboardWriteFailed', 'Copy failed');
    const original = tr('supportContactCopyEmail', 'Copy Email');
    const icon = button.querySelector('.support-contact-card__button-icon')?.outerHTML ?? '';
    button.innerHTML = `${icon}${label}`;
    window.setTimeout(() => {
        button.innerHTML = `${icon}${original}`;
    }, 1400);
}
