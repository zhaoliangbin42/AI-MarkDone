import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite Config for Firefox Background Build
 *
 * MV2 background scripts must be classic scripts. Rollup `format: 'es'` is used,
 * but we build a single-entry bundle to avoid top-level `import` in output.
 */
export default defineConfig({
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
        outDir: 'dist-firefox',
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

