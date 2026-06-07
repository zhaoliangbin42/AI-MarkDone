import type { BookmarksDocBlock } from '../../content/types';

export function renderInfoBlocks(
    blocks: BookmarksDocBlock[],
    options?: { listClassName?: string; listItemClassName?: string; resolveAssetUrl?: (assetPath: string) => string },
): DocumentFragment {
    const fragment = document.createDocumentFragment();

    for (const block of blocks) {
        if (block.type === 'paragraph') {
            const paragraph = document.createElement('p');
            paragraph.className = 'info-copy';
            appendInlineMarkdown(paragraph, block.text);
            fragment.appendChild(paragraph);
            continue;
        }

        if (block.type === 'image') {
            const frame = document.createElement('div');
            frame.className = 'info-media';
            const image = document.createElement('img');
            image.className = 'info-media__image';
            image.alt = block.alt;
            image.src = options?.resolveAssetUrl ? options.resolveAssetUrl(block.src) : block.src;
            frame.appendChild(image);
            fragment.appendChild(frame);
            continue;
        }

        const list = document.createElement('ul');
        list.className = options?.listClassName ?? 'info-list';
        for (const item of block.items) {
            const li = document.createElement('li');
            if (options?.listItemClassName) li.className = options.listItemClassName;
            appendInlineMarkdown(li, item);
            list.appendChild(li);
        }
        fragment.appendChild(list);
    }

    return fragment;
}

const inlineMarkdownPattern = /(==([^=\n][\s\S]*?)==|\*\*([^*][\s\S]*?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

function appendInlineMarkdown(container: HTMLElement, text: string): void {
    let lastIndex = 0;

    for (const match of text.matchAll(inlineMarkdownPattern)) {
        const matchIndex = match.index ?? -1;
        if (matchIndex < 0) continue;

        if (matchIndex > lastIndex) {
            appendTextWithLineBreaks(container, text.slice(lastIndex, matchIndex));
        }

        if (match[2]) {
            const mark = document.createElement('span');
            mark.className = 'info-mark';
            appendTextWithLineBreaks(mark, match[2]);
            container.append(mark);
        } else if (match[3]) {
            const strong = document.createElement('strong');
            appendTextWithLineBreaks(strong, match[3]);
            container.append(strong);
        } else if (match[4] && match[5]) {
            const anchor = document.createElement('a');
            anchor.href = match[5];
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            appendTextWithLineBreaks(anchor, match[4]);
            container.append(anchor);
        }
        lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex === 0) {
        appendTextWithLineBreaks(container, text);
        return;
    }

    if (lastIndex < text.length) {
        appendTextWithLineBreaks(container, text.slice(lastIndex));
    }
}

function appendTextWithLineBreaks(container: HTMLElement, text: string): void {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
        if (index > 0) {
            container.append(document.createElement('br'));
        }
        if (line) {
            container.append(document.createTextNode(line));
        }
    });
}
