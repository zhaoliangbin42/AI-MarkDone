import { extensionAssets } from '../../../config/extension/assets';
import {
    parseLatexSnippetCatalog,
    type LatexSnippetCatalog,
} from '../../core/math/latexSnippets';
import { browser } from '../../drivers/shared/browser';

let catalogPromise: Promise<LatexSnippetCatalog> | null = null;

export function loadLatexSnippetCatalog(): Promise<LatexSnippetCatalog> {
    catalogPromise ??= fetch(browser.runtime.getURL(extensionAssets.formulaSnippetCatalog))
        .then((response) => {
            if (!response.ok) throw new Error(`Formula snippet catalog failed to load (${response.status}).`);
            return response.json();
        })
        .then(parseLatexSnippetCatalog)
        .catch((error) => {
            catalogPromise = null;
            throw error;
        });
    return catalogPromise;
}

export function __resetLatexSnippetCatalogForTests(): void {
    catalogPromise = null;
}
