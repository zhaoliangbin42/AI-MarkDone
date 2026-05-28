import { extensionIconFiles } from './surface';
import type { ExtensionTarget } from './targets';

const sharedNonIconWebAccessibleResources = [
    '_locales/*/messages.json',
    'vendor/katex/*.css',
    'vendor/katex/fonts/*',
    'page-bridges/*.js',
    'formula-renderer.html',
    'formula-renderer.js',
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
