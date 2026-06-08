import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extensionIconFiles, safariExcludedLocaleMessageKeys } from '../config/extension/surface';
import { extensionTargets, type ExtensionTarget } from '../config/extension/targets';
import { isExtensionTarget, writeManifest } from './generate-manifest';

function copyPngFiles(sourceDir: string, targetDir: string, allowlist?: readonly string[]): void {
    mkdirSync(targetDir, { recursive: true });
    const allowed = allowlist ? new Set(allowlist) : null;
    for (const entry of readdirSync(sourceDir)) {
        if (!entry.endsWith('.png')) continue;
        if (allowed && !allowed.has(entry)) continue;
        cpSync(join(sourceDir, entry), join(targetDir, entry));
    }
}

function copyLocales(target: ExtensionTarget, sourceDir: string, targetDir: string): void {
    const locales = readdirSync(sourceDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

    if (target !== 'safari') {
        mkdirSync(targetDir, { recursive: true });
        for (const locale of locales) {
            cpSync(join(sourceDir, locale), join(targetDir, locale), { recursive: true });
        }
        return;
    }

    mkdirSync(targetDir, { recursive: true });
    const excludedKeys = new Set(safariExcludedLocaleMessageKeys);
    for (const locale of locales) {
        const sourceFile = join(sourceDir, locale, 'messages.json');
        const localeTargetDir = join(targetDir, locale);
        const targetFile = join(localeTargetDir, 'messages.json');
        const messages = JSON.parse(readFileSync(sourceFile, 'utf8')) as Record<string, unknown>;
        for (const key of excludedKeys) {
            delete messages[key];
        }
        mkdirSync(localeTargetDir, { recursive: true });
        writeFileSync(targetFile, `${JSON.stringify(messages, null, 4)}\n`);
    }
}

export function prepareExtensionTarget(target: ExtensionTarget): void {
    const distDir = resolve(process.cwd(), extensionTargets[target].distDir);

    writeManifest(target, join(distDir, 'manifest.json'));
    copyPngFiles(
        resolve(process.cwd(), 'public/icons'),
        join(distDir, 'icons'),
        target === 'safari' ? extensionIconFiles : undefined,
    );
    copyLocales(target, resolve(process.cwd(), 'public/_locales'), join(distDir, '_locales'));
    cpSync(resolve(process.cwd(), 'public/page-bridges'), join(distDir, 'page-bridges'), { recursive: true });
    cpSync(resolve(process.cwd(), 'public/formula-renderer.html'), join(distDir, 'formula-renderer.html'));
    cpSync(resolve(process.cwd(), 'public/reader.html'), join(distDir, 'reader.html'));
    mkdirSync(join(distDir, 'src/popup'), { recursive: true });
    cpSync(resolve(process.cwd(), 'src/popup/popup.html'), join(distDir, 'src/popup/popup.html'));
    cpSync(resolve(process.cwd(), 'src/popup/popup.js'), join(distDir, 'src/popup/popup.js'));
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
