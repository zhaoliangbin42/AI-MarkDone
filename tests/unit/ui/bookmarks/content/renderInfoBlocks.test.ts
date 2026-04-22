import { describe, expect, it } from 'vitest';

import { renderInfoBlocks } from '@/ui/content/bookmarks/ui/tabs/renderInfoBlocks';

describe('renderInfoBlocks', () => {
    it('renders bold inline markdown for paragraphs and list items', () => {
        const fragment = renderInfoBlocks([
            { type: 'paragraph', text: 'Keep **this part** visible.' },
            { type: 'list', items: ['First **important** point'] },
        ]);

        const host = document.createElement('div');
        host.appendChild(fragment);

        const paragraph = host.querySelector('p.info-copy');
        const paragraphStrong = paragraph?.querySelector('strong');
        const listItem = host.querySelector('ul.info-list li');
        const listStrong = listItem?.querySelector('strong');

        expect(paragraph?.textContent).toBe('Keep this part visible.');
        expect(paragraphStrong?.textContent).toBe('this part');
        expect(listItem?.textContent).toBe('First important point');
        expect(listStrong?.textContent).toBe('important');
    });

    it('renders image blocks through the provided asset resolver', () => {
        const fragment = renderInfoBlocks(
            [{ type: 'image', alt: 'Project mark', src: 'icons/icon128.png' }],
            {
                resolveAssetUrl: (assetPath) => `chrome-extension://test/${assetPath}`,
            },
        );

        const host = document.createElement('div');
        host.appendChild(fragment);

        const frame = host.querySelector<HTMLElement>('.info-media');
        const image = host.querySelector<HTMLImageElement>('.info-media__image');

        expect(frame).toBeTruthy();
        expect(image?.alt).toBe('Project mark');
        expect(image?.src).toBe('chrome-extension://test/icons/icon128.png');
    });

    it('renders preserved line breaks inside paragraphs and list items', () => {
        const fragment = renderInfoBlocks([
            { type: 'paragraph', text: 'First line\nSecond **line**' },
            { type: 'list', items: ['Alpha\nBeta'] },
        ]);

        const host = document.createElement('div');
        host.appendChild(fragment);

        const paragraph = host.querySelector('p.info-copy');
        const listItem = host.querySelector('ul.info-list li');

        expect(paragraph?.querySelectorAll('br')).toHaveLength(1);
        expect(paragraph?.textContent).toBe('First lineSecond line');
        expect(paragraph?.querySelector('strong')?.textContent).toBe('line');
        expect(listItem?.querySelectorAll('br')).toHaveLength(1);
        expect(listItem?.textContent).toBe('AlphaBeta');
    });
});
