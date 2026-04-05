import { createKatexMarkdownParserAdapter } from './katex';
import type { MarkdownParserAdapter } from './MarkdownParserAdapter';

type ChatGPTMarkdownParserAdapter = MarkdownParserAdapter & {
    extractCodeBlockText?: (blockElem: HTMLElement) => string | null;
};

const baseAdapter = createKatexMarkdownParserAdapter('ChatGPT', 'ChatGPTParserAdapter');

function serializeCodeViewerNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
    }

    const element = node as HTMLElement;
    if (element.tagName === 'BR') return '\n';

    const childText = Array.from(element.childNodes).map((child) => serializeCodeViewerNode(child)).join('');
    if (element.classList.contains('cm-line') || element.tagName === 'DIV' || element.tagName === 'P') {
        return `${childText}\n`;
    }

    return childText;
}

function extractCodeViewerText(blockElem: HTMLElement): string | null {
    const content =
        (blockElem.querySelector('.cm-content') as HTMLElement | null) ||
        (blockElem.querySelector('[data-lexical-editor="true"]') as HTMLElement | null);
    if (!content) return null;

    const raw = Array.from(content.childNodes).map((child) => serializeCodeViewerNode(child)).join('');
    const normalized = raw.replace(/\u00a0/g, ' ').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return normalized || null;
}

function extractHeaderLanguage(blockElem: HTMLElement): string {
    const candidates = [
        '.sticky .cursor-default',
        '.sticky .text-sm.font-medium',
        '[data-code-language]',
        '[data-language]',
        '[data-lang]',
    ];

    for (const selector of candidates) {
        const el = blockElem.querySelector(selector) as HTMLElement | null;
        const value =
            el?.getAttribute('data-code-language')
            || el?.getAttribute('data-language')
            || el?.getAttribute('data-lang')
            || el?.textContent;
        const trimmed = value?.trim();
        if (trimmed) return trimmed.toLowerCase();
    }

    return '';
}

export const chatgptMarkdownParserAdapter: ChatGPTMarkdownParserAdapter = {
    ...baseAdapter,
    isCodeBlockNode(node: Element): boolean {
        const element = node as HTMLElement;
        if (baseAdapter.isCodeBlockNode(node)) return true;
        return element.tagName === 'PRE' && extractCodeViewerText(element) !== null;
    },
    getCodeLanguage(codeBlock: HTMLElement): string {
        const legacyLanguage = baseAdapter.getCodeLanguage(codeBlock);
        if (legacyLanguage) return legacyLanguage.toLowerCase();

        const pre = codeBlock.matches('pre') ? codeBlock : codeBlock.closest('pre');
        if (pre instanceof HTMLElement) {
            const headerLanguage = extractHeaderLanguage(pre);
            if (headerLanguage) return headerLanguage;
        }

        return '';
    },
    extractCodeBlockText(blockElem: HTMLElement): string | null {
        if (!blockElem.matches('pre')) return null;
        if (blockElem.querySelector('code')) return null;
        return extractCodeViewerText(blockElem);
    },
};
