import { resolve } from 'node:path';
import { build, type InlineConfig } from 'vite';
import { isExtensionTarget } from './generate-manifest';
import { extensionTargets, type ExtensionTarget } from '../config/extension/targets';

function sharedConfig(target: ExtensionTarget): InlineConfig {
    return {
        configFile: false,
        publicDir: false,
        esbuild: { charset: 'ascii' },
        build: {
            modulePreload: { polyfill: false },
            outDir: extensionTargets[target].distDir,
            emptyOutDir: false,
            minify: 'esbuild',
            sourcemap: false,
            target: 'esnext',
        },
        resolve: {
            alias: {
                '@': resolve(process.cwd(), 'src'),
                'vfile-location': resolve(process.cwd(), 'src/utils/markdown/vfile-location-shim.ts'),
            },
        },
    };
}

async function buildRendererHost(target: ExtensionTarget): Promise<void> {
    const config = sharedConfig(target);
    await build({
        ...config,
        build: {
            ...config.build,
            rollupOptions: {
                input: {
                    'export-renderer': resolve(process.cwd(), 'src/runtimes/export-renderer/entry.ts'),
                },
                output: {
                    entryFileNames: '[name].js',
                    chunkFileNames: 'export-renderer-chunks/[name]-[hash].js',
                    assetFileNames: 'export-renderer-assets/[name]-[hash][extname]',
                    format: 'es',
                },
            },
        },
    });
}

async function buildPngWorker(target: ExtensionTarget): Promise<void> {
    const config = sharedConfig(target);
    await build({
        ...config,
        build: {
            ...config.build,
            rollupOptions: {
                input: {
                    'png-encoder-worker': resolve(process.cwd(), 'src/runtimes/export-renderer/pngEncoderWorker.ts'),
                },
                output: {
                    entryFileNames: '[name].js',
                    format: 'iife',
                    inlineDynamicImports: true,
                },
            },
        },
    });
}

async function main(): Promise<void> {
    const target = process.argv[2] ?? '';
    if (!isExtensionTarget(target)) {
        throw new Error('Usage: tsx scripts/build-export-renderer.ts <chrome|firefox|safari>');
    }
    await buildRendererHost(target);
    await buildPngWorker(target);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
