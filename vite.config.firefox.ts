import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite Config for Firefox Build
 * 
 * Firefox 使用纯 JS background script (无需编译)
 * 只编译 content script
 */
export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.ts'),
                // Note: background-firefox.js 是纯 JS，通过 postbuild 复制
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            }
        },
        outDir: 'dist-firefox',
        emptyOutDir: true,
        minify: false,
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
