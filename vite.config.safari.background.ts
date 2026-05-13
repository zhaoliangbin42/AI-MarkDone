import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
