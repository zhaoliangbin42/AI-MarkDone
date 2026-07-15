import { extensionIconFiles } from './surface';
import type { ExtensionTarget } from './targets';

const sharedNonIconWebAccessibleResources = [
    '_locales/*/messages.json',
    'vendor/katex/*.css',
    'vendor/katex/fonts/*',
    'vendor/latex-workshop/formula-snippets.json',
    'page-bridges/*.js',
    'export-renderer.html',
    'content-features.js',
    'content-feature-chunks/*.js',
] as const;

const defaultWebAccessibleResources = [
    'icons/*.png',
    ...sharedNonIconWebAccessibleResources,
] as const;

const safariWebAccessibleResources = [
    ...extensionIconFiles.map((file) => `icons/${file}`),
    ...sharedNonIconWebAccessibleResources,
] as const;

export const extensionAssets = {
    contentEntry: 'content.js',
    contentFeaturesEntry: 'content-features.js',
    exportRendererPath: 'export-renderer.html',
    formulaSnippetCatalog: 'vendor/latex-workshop/formula-snippets.json',
    backgroundEntry: 'background.js',
    popupPath: 'src/popup/popup.html',
    icons: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
    },
    disabledIcons: {
        '16': 'icons/icon16_gray.png',
        '48': 'icons/icon48_gray.png',
        '128': 'icons/icon128_gray.png',
    },
    webAccessibleResources: defaultWebAccessibleResources,
    safariWebAccessibleResources,
} as const;

export function getWebAccessibleResourcesForTarget(target: ExtensionTarget): readonly string[] {
    return target === 'safari'
        ? extensionAssets.safariWebAccessibleResources
        : extensionAssets.webAccessibleResources;
}
