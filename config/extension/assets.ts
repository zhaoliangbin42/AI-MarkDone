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
    webAccessibleResources: [
        'icons/*.png',
        '_locales/*/messages.json',
        'vendor/katex/*.css',
        'vendor/katex/fonts/*',
        'page-bridges/*.js',
    ],
} as const;
