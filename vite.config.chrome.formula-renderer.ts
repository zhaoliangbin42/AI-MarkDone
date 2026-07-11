import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    esbuild: {
        charset: 'ascii',
    },
    build: {
        modulePreload: {
            polyfill: false,
        },
        rollupOptions: {
            input: {
                'formula-renderer': resolve(__dirname, 'src/runtimes/formula-renderer/entry.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                format: 'iife',
                inlineDynamicImports: true,
            },
        },
        outDir: 'dist-chrome',
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
