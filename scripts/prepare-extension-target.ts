import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionTargets, type ExtensionTarget } from '../config/extension/targets';
import { isExtensionTarget, writeManifest } from './generate-manifest';

function copyPngFiles(sourceDir: string, targetDir: string): void {
    mkdirSync(targetDir, { recursive: true });
    for (const entry of readdirSync(sourceDir)) {
        if (!entry.endsWith('.png')) continue;
        cpSync(join(sourceDir, entry), join(targetDir, entry));
    }
}

export function prepareExtensionTarget(target: ExtensionTarget): void {
    const distDir = resolve(process.cwd(), extensionTargets[target].distDir);

    writeManifest(target, join(distDir, 'manifest.json'));
    copyPngFiles(resolve(process.cwd(), 'public/icons'), join(distDir, 'icons'));
    cpSync(resolve(process.cwd(), 'public/_locales'), join(distDir, '_locales'), { recursive: true });
    cpSync(resolve(process.cwd(), 'public/page-bridges'), join(distDir, 'page-bridges'), { recursive: true });
    mkdirSync(join(distDir, 'src/popup'), { recursive: true });
    cpSync(resolve(process.cwd(), 'src/popup/popup.html'), join(distDir, 'src/popup/popup.html'));
    mkdirSync(join(distDir, 'vendor/katex'), { recursive: true });
    cpSync(resolve(process.cwd(), 'node_modules/katex/dist/katex.min.css'), join(distDir, 'vendor/katex/katex.min.css'));
    cpSync(resolve(process.cwd(), 'node_modules/katex/dist/fonts'), join(distDir, 'vendor/katex/fonts'), { recursive: true });
}

function runCli(): void {
    const target = process.argv[2] ?? '';
    if (!isExtensionTarget(target)) {
        console.error('Usage: tsx scripts/prepare-extension-target.ts <chrome|firefox|safari>');
        process.exit(1);
    }
    prepareExtensionTarget(target);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    runCli();
}
