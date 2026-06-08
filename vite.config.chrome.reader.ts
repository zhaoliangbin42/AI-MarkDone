import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';

export default defineConfig({
    define: {
        __AIMD_ENABLE_SPONSOR_TAB__: JSON.stringify(extensionSurfacePolicies.chrome.sponsorTab),
        __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__: JSON.stringify(extensionSurfacePolicies.chrome.socialFollowCard),
        __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__: JSON.stringify(extensionSurfacePolicies.chrome.binaryClipboardCopyActions),
    },
    build: {
        modulePreload: {
            polyfill: false,
        },
        rollupOptions: {
            input: resolve(__dirname, 'src/runtimes/reader/entry.ts'),
            output: {
                entryFileNames: 'reader.js',
                format: 'es',
                inlineDynamicImports: true,
            },
        },
        outDir: 'dist-chrome',
        emptyOutDir: false,
        minify: false,
        sourcemap: false,
        target: 'esnext',
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'vfile-location': resolve(__dirname, './src/utils/markdown/vfile-location-shim.ts'),
        },
    },
});
