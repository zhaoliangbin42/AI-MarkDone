import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    build: {
        modulePreload: {
            polyfill: false  // Disable Vite's modulepreload polyfill (uses document, incompatible with Service Worker)
        },
        rollupOptions: {
            input: {
                'content-early': resolve(__dirname, 'src/runtimes/content/early.ts'),
                'content-early-main': resolve(__dirname, 'src/runtimes/content/early-main.ts'),
                content: resolve(__dirname, 'src/runtimes/content/entry.ts'),
                background: resolve(__dirname, 'src/runtimes/background/entry.ts')
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            }
        },
        outDir: 'dist',
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
