import { copyIcon } from '../../../assets/icons';
import { createIcon } from '../components/Icon';

type EnhanceReaderCodeBlocksOptions = {
    copyLabel: string;
};

function normalizeLanguageLabel(language: string | null): string | null {
    if (!language) return null;
    const trimmed = language.trim();
    if (!trimmed) return null;
    return trimmed.toUpperCase();
}

export function enhanceReaderCodeBlocks(root: ParentNode, options: EnhanceReaderCodeBlocksOptions): void {
    const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre'));

    for (const pre of codeBlocks) {
        if (pre.parentElement?.classList.contains('reader-code-block__scroll')) continue;

        const code = pre.querySelector<HTMLElement>('code');
        if (!code) continue;

        const wrapper = document.createElement('div');
        wrapper.className = 'reader-code-block';

        const header = document.createElement('div');
        header.className = 'reader-code-block__header';

        const language = normalizeLanguageLabel(pre.dataset.codeLanguage ?? null);
        if (language) {
            const languageEl = document.createElement('span');
            languageEl.className = 'reader-code-block__language';
            languageEl.textContent = language;
            header.appendChild(languageEl);
        }

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
