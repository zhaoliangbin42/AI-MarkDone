import { defineConfig } from 'vite';
import { resolve } from 'path';
import { extensionSurfacePolicies } from './config/extension/surface';

/**
 * Vite Config for Chrome Build
 * 
 * Chrome 使用 service-worker.ts 作为 background script
 */
export default defineConfig({
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
            polyfill: false  // Service Worker compatibility (keep disabled across targets)
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
        outDir: 'dist-chrome',
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
