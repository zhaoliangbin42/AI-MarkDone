import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';

export default defineConfig({
    esbuild: {
        charset: 'ascii',
    },
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
            input: resolve(__dirname, 'src/runtimes/reader/entry.ts'),
            output: {
                entryFileNames: 'reader.js',
                format: 'es',
                inlineDynamicImports: true,
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
