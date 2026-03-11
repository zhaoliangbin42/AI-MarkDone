import hljsModule from 'highlight.js/lib/common';

const hljs = hljsModule;

async function highlightCodeBlocks(container: HTMLElement): Promise<void> {
    container.querySelectorAll<HTMLElement>('pre code').forEach((code) => {
        if (code.dataset.aimdHighlighted === '1') return;
        hljs.highlightElement(code);
        code.dataset.aimdHighlighted = '1';
    });
}

export async function enhanceRenderedMarkdown(container: HTMLElement): Promise<void> {
    await highlightCodeBlocks(container);
}
