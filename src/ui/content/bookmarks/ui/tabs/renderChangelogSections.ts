import type { ParsedChangelogCategory } from '../../content/types';
import { renderInfoBlocks } from './renderInfoBlocks';

export function renderChangelogSections(
    sections: ParsedChangelogCategory[],
    options?: { resolveAssetUrl?: (assetPath: string) => string },
): DocumentFragment {
    const fragment = document.createDocumentFragment();

    for (const section of sections) {
        const shell = document.createElement('section');
        shell.className = 'changelog-entry-section';

        const heading = document.createElement('h4');
        heading.className = 'changelog-entry-section__title';
        heading.textContent = section.heading;
        shell.appendChild(heading);

        const body = document.createElement('div');
        body.className = 'changelog-entry-section__body';
        body.appendChild(renderInfoBlocks(section.blocks, { resolveAssetUrl: options?.resolveAssetUrl }));
        shell.appendChild(body);

        fragment.appendChild(shell);
    }

    return fragment;
}
