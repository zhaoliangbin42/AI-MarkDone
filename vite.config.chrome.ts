import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite Config for Chrome Build
 * 
 * Chrome 使用 service-worker.ts 作为 background script
 */
export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.ts'),
                background: resolve(__dirname, 'src/background/service-worker.ts')
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            }
        },
        outDir: 'dist-chrome',
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
