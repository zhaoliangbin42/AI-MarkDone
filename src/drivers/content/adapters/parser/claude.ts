import { createKatexMarkdownParserAdapter } from './katex';
import type { MarkdownParserAdapter } from './MarkdownParserAdapter';

type ClaudeMarkdownParserAdapter = MarkdownParserAdapter & {
    extractCodeBlockText?: (blockElem: HTMLElement) => string | null;
};

const baseAdapter = createKatexMarkdownParserAdapter('Claude', 'ClaudeParserAdapter');

function isClaudeCodeBlockWrapper(node: HTMLElement): boolean {
    const overflow = Array.from(node.children).find((child): child is HTMLElement => {
        if (!(child instanceof HTMLElement) || !child.classList.contains('overflow-x-auto')) return false;
        return child.querySelector(':scope > pre.code-block__code') instanceof HTMLElement;
    });
    if (!overflow) return false;

    const languageLabel = Array.from(node.children).find(
        (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('font-small')
    );
    return languageLabel instanceof HTMLElement;
}

function findClaudeCodeBlockWrapper(node: HTMLElement): HTMLElement | null {
    if (node.matches('pre.code-block__code')) {
        const wrapper = node.parentElement?.parentElement;
        return wrapper instanceof HTMLElement && isClaudeCodeBlockWrapper(wrapper) ? wrapper : null;
    }
    return isClaudeCodeBlockWrapper(node) ? node : null;
}

function extractWrapperCode(blockElem: HTMLElement): string | null {
    const wrapper = findClaudeCodeBlockWrapper(blockElem);
    if (!wrapper) return null;

    const code = wrapper.querySelector('pre.code-block__code code');
    const text = code?.textContent?.replace(/\r\n?/g, '\n').trim() || '';
    return text || null;
}

function extractWrapperLanguage(blockElem: HTMLElement): string {
    const wrapper = findClaudeCodeBlockWrapper(blockElem);
    if (!wrapper) return '';

    const code = wrapper.querySelector('pre.code-block__code code') as HTMLElement | null;
    const classLanguage = Array.from(code?.classList || []).find((cls) => cls.startsWith('language-'));
    if (classLanguage) return classLanguage.replace('language-', '').toLowerCase();

    const label = wrapper.querySelector('.font-small') as HTMLElement | null;
    const text = label?.textContent?.trim().toLowerCase();
    return text || '';
}

export const claudeMarkdownParserAdapter: ClaudeMarkdownParserAdapter = {
    ...baseAdapter,
    isCodeBlockNode(node: Element): boolean {
        const element = node as HTMLElement;
        if (baseAdapter.isCodeBlockNode(node)) {
            return !findClaudeCodeBlockWrapper(element);
        }
        return findClaudeCodeBlockWrapper(element) !== null;
    },
    getCodeLanguage(codeBlock: HTMLElement): string {
        const wrappedLanguage = extractWrapperLanguage(codeBlock);
        if (wrappedLanguage) return wrappedLanguage;
        return baseAdapter.getCodeLanguage(codeBlock).toLowerCase();
    },
    extractCodeBlockText(blockElem: HTMLElement): string | null {
        return extractWrapperCode(blockElem);
    },
};
