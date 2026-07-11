import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';

export default defineConfig({
    base: './',
    esbuild: {
        charset: 'ascii',
    },
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
            preserveEntrySignatures: 'exports-only',
            input: {
                reader: resolve(__dirname, 'src/runtimes/reader/entry.ts'),
                'content-features': resolve(__dirname, 'src/runtimes/content/contentFeatures.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'content-feature-chunks/[name]-[hash].js',
                format: 'es',
            },
        },
        outDir: 'dist-chrome',
        emptyOutDir: false,
        minify: 'esbuild',
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
