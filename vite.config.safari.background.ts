import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';

export default defineConfig({
    publicDir: false,
    define: {
        __AIMD_ENABLE_SPONSOR_TAB__: JSON.stringify(extensionSurfacePolicies.safari.sponsorTab),
        __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__: JSON.stringify(extensionSurfacePolicies.safari.socialFollowCard),
        __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__: JSON.stringify(extensionSurfacePolicies.safari.binaryClipboardCopyActions),
    },
    build: {
        modulePreload: {
            polyfill: false,
        },
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/runtimes/background/entry.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            },
        },
        outDir: 'dist-safari',
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
