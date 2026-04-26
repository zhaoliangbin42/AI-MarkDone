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

    it('renders safe markdown links in paragraphs and list items', () => {
        const fragment = renderInfoBlocks([
            { type: 'paragraph', text: 'Try [Gemini Voyager](https://github.com/Nagi-ovo/gemini-voyager).' },
            { type: 'list', items: ['See [Timeline](https://github.com/houyanchao/Timeline)'] },
        ]);

        const host = document.createElement('div');
        host.appendChild(fragment);

        const paragraphLink = host.querySelector<HTMLAnchorElement>('p.info-copy a');
        const listLink = host.querySelector<HTMLAnchorElement>('ul.info-list li a');

        expect(paragraphLink?.textContent).toBe('Gemini Voyager');
        expect(paragraphLink?.href).toBe('https://github.com/Nagi-ovo/gemini-voyager');
        expect(paragraphLink?.target).toBe('_blank');
        expect(paragraphLink?.rel).toBe('noopener noreferrer');
        expect(listLink?.textContent).toBe('Timeline');
        expect(listLink?.href).toBe('https://github.com/houyanchao/Timeline');
    });
});
