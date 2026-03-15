import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite Config for Chrome Background Build
 *
 * Why: build background separately to avoid shared chunks across multiple entries,
 * so the final `background.js` contains no top-level `import` statements.
 */
export default defineConfig({
    plugins: [tailwindcss()],
    build: {
        modulePreload: {
            polyfill: false
        },
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/runtimes/background/entry.ts')
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            }
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
            'vfile-location': resolve(__dirname, './src/utils/markdown/vfile-location-shim.ts')
        }
    }
});
