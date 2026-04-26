import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    build: {
        modulePreload: {
            polyfill: false,
        },
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/runtimes/content/entry.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es',
            },
        },
        outDir: 'dist-safari',
        emptyOutDir: true,
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
