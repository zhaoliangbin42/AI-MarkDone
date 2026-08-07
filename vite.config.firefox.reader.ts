import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';
import { escapeUtf8JavaScriptNoncharacters } from './config/extension/utf8JavaScript';

export default defineConfig({
    base: './',
    esbuild: {
        charset: 'utf8',
    },
    plugins: [escapeUtf8JavaScriptNoncharacters()],
    define: {
        __AIMD_ENABLE_SPONSOR_TAB__: JSON.stringify(extensionSurfacePolicies.firefox.sponsorTab),
        __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__: JSON.stringify(extensionSurfacePolicies.firefox.socialFollowCard),
        __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__: JSON.stringify(extensionSurfacePolicies.firefox.binaryClipboardCopyActions),
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
        outDir: 'dist-firefox',
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
