import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';

/**
 * Vite Config for Firefox Build
 * 
 * Firefox 使用纯 JS background script (无需编译)
 * 只编译 content script
 */
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
            polyfill: false
        },
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/runtimes/content/entry.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            }
        },
        outDir: 'dist-firefox',
        emptyOutDir: true,
        minify: 'esbuild',
        sourcemap: false,
        target: 'esnext',
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'vfile-location': resolve(__dirname, './src/utils/markdown/vfile-location-shim.ts')
        }
    }
});
