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

const boldPattern = /\*\*([^*][\s\S]*?)\*\*/g;

function appendInlineMarkdown(container: HTMLElement, text: string): void {
    let lastIndex = 0;

    for (const match of text.matchAll(boldPattern)) {
        const matchIndex = match.index ?? -1;
        if (matchIndex < 0) continue;

        if (matchIndex > lastIndex) {
            container.append(document.createTextNode(text.slice(lastIndex, matchIndex)));
        }

        const strong = document.createElement('strong');
        strong.textContent = match[1];
        container.append(strong);
        lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex === 0) {
        container.textContent = text;
        return;
    }

    if (lastIndex < text.length) {
        container.append(document.createTextNode(text.slice(lastIndex)));
    }
}
