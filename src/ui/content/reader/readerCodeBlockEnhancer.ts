import { copyIcon, wrapTextIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';

type EnhanceReaderCodeBlocksOptions = {
    copyLabel: string;
    wrapLabel: string;
    unwrapLabel: string;
};

const SOFT_WRAP_CODE_LANGUAGES = new Set([
    'latex',
    'tex',
]);

function normalizeLanguageLabel(language: string | null): string | null {
    if (!language) return null;
    const trimmed = language.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
}

function shouldSoftWrapCodeBlock(language: string | null): boolean {
    if (!language) return false;
    return SOFT_WRAP_CODE_LANGUAGES.has(language.trim().toLowerCase());
}

function syncWrapToggleButton(button: HTMLButtonElement, wrapped: boolean): void {
    const label = wrapped ? button.dataset.unwrapLabel : button.dataset.wrapLabel;
    if (label) {
        button.setAttribute('aria-label', label);
        button.title = label;
    }
    button.setAttribute('aria-pressed', wrapped ? 'true' : 'false');
}

export function syncReaderCodeWrapButton(block: HTMLElement): void {
    const button = block.querySelector<HTMLButtonElement>('[data-action="reader-code-wrap-toggle"]');
    if (!button) return;
    syncWrapToggleButton(button, block.classList.contains('reader-code-block--soft-wrap'));
}

export function toggleReaderCodeWrap(button: HTMLElement): void {
    const block = button.closest<HTMLElement>('.reader-code-block');
    if (!block) return;
    block.classList.toggle('reader-code-block--soft-wrap');
    syncReaderCodeWrapButton(block);
}

export function enhanceReaderCodeBlocks(root: ParentNode, options: EnhanceReaderCodeBlocksOptions): void {
    const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre'));

    for (const pre of codeBlocks) {
        if (pre.parentElement?.classList.contains('reader-code-block__scroll')) continue;

        const code = pre.querySelector<HTMLElement>('code');
        if (!code) continue;

        const wrapper = document.createElement('div');
        wrapper.className = 'reader-code-block';
        const rawLanguage = pre.dataset.codeLanguage ?? null;
        if (shouldSoftWrapCodeBlock(rawLanguage)) wrapper.classList.add('reader-code-block--soft-wrap');

        const header = document.createElement('div');
        header.className = 'reader-code-block__header';

        const language = normalizeLanguageLabel(rawLanguage);
        if (language) {
            const languageEl = document.createElement('span');
            languageEl.className = 'reader-code-block__language';
            languageEl.textContent = language;
            header.appendChild(languageEl);
        }

        const wrapButton = document.createElement('button');
        wrapButton.type = 'button';
        wrapButton.className = 'icon-btn reader-code-block__wrap';
        wrapButton.dataset.action = 'reader-code-wrap-toggle';
        wrapButton.dataset.wrapLabel = options.wrapLabel;
        wrapButton.dataset.unwrapLabel = options.unwrapLabel;
        wrapButton.appendChild(createIcon(wrapTextIcon));
        syncWrapToggleButton(wrapButton, wrapper.classList.contains('reader-code-block--soft-wrap'));
        header.appendChild(wrapButton);

        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.className = 'icon-btn reader-code-block__copy';
        copyButton.dataset.action = 'reader-copy-code';
        copyButton.setAttribute('aria-label', options.copyLabel);
        copyButton.title = options.copyLabel;
        copyButton.appendChild(createIcon(copyIcon));
        header.appendChild(copyButton);

        const scroll = document.createElement('div');
        scroll.className = 'reader-code-block__scroll';

        const parent = pre.parentNode;
        if (!parent) continue;

        parent.insertBefore(wrapper, pre);
        scroll.appendChild(pre);
        wrapper.append(header, scroll);
    }
}

export function decorateReaderCodeBlocksHtml(html: string, options: EnhanceReaderCodeBlocksOptions): string {
    if (!html.trim()) return html;

    const template = document.createElement('template');
    template.innerHTML = html;
    enhanceReaderCodeBlocks(template.content, options);
    return template.innerHTML;
}
