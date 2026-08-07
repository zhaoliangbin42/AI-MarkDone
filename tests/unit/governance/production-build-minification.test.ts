import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { escapeJavaScriptUnicodeNoncharacters } from '../../../config/extension/utf8JavaScript';

describe('production build minification', () => {
    it('keeps every extension runtime build on the same explicit esbuild minifier', () => {
        const repoRoot = process.cwd();
        const configFiles = readdirSync(repoRoot)
            .filter((name) => /^vite\.config(?:\.(?:chrome|firefox)(?:\.(?:background|reader))?)?\.ts$/.test(name))
            .sort();

        expect(configFiles).toHaveLength(7);
        for (const configFile of configFiles) {
            const source = readFileSync(resolve(repoRoot, configFile), 'utf8');
            expect(source, configFile).toContain("minify: 'esbuild'");
            expect(source, configFile).not.toContain('minify: false');
        }

        const exportRendererBuild = readFileSync(resolve(repoRoot, 'scripts/build-export-renderer.ts'), 'utf8');
        expect(exportRendererBuild).toContain("minify: 'esbuild'");
        expect(exportRendererBuild).not.toContain('minify: false');
    });

    it('uses UTF-8 for text-heavy Reader graphs while keeping classic and renderer builds ASCII', () => {
        const repoRoot = process.cwd();
        const readerConfigFiles = [
            'vite.config.chrome.reader.ts',
            'vite.config.firefox.reader.ts',
        ];
        for (const configFile of readerConfigFiles) {
            const source = readFileSync(resolve(repoRoot, configFile), 'utf8');
            expect(source, configFile).toContain("charset: 'utf8'");
            expect(source, configFile).not.toContain("charset: 'ascii'");
            expect(source, configFile).toContain('escapeUtf8JavaScriptNoncharacters()');
        }

        const asciiBuildFiles = [
            'vite.config.ts',
            'vite.config.chrome.ts',
            'vite.config.chrome.background.ts',
            'vite.config.firefox.ts',
            'vite.config.firefox.background.ts',
            'scripts/build-export-renderer.ts',
        ];
        for (const buildFile of asciiBuildFiles) {
            const source = readFileSync(resolve(repoRoot, buildFile), 'utf8');
            expect(source, buildFile).toContain("charset: 'ascii'");
            expect(source, buildFile).not.toContain("charset: 'utf8'");
        }
    });

    it('preserves ordinary UTF-8 while escaping JavaScript Unicode noncharacters', () => {
        const source = `const text = "中文${String.fromCodePoint(0xFDD0, 0xFFFF, 0x1FFFE, 0x10FFFF)}";`;
        const escaped = escapeJavaScriptUnicodeNoncharacters(source);

        expect(escaped).toContain('中文');
        expect(escaped).toContain('\\uFDD0');
        expect(escaped).toContain('\\uFFFF');
        expect(escaped).toContain('\\uD83F\\uDFFE');
        expect(escaped).toContain('\\uDBFF\\uDFFF');
        for (const character of escaped) {
            const codePoint = character.codePointAt(0)!;
            expect(codePoint < 0xFDD0 || codePoint > 0xFDEF).toBe(true);
            expect((codePoint & 0xFFFF) !== 0xFFFE && (codePoint & 0xFFFF) !== 0xFFFF).toBe(true);
        }
    });

    it('enforces bundle budgets at the end of each browser build command', () => {
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };

        expect(pkg.scripts.build).toContain('npm run verify:bundle-size');
        expect(pkg.scripts['verify:bundle-size']).toBe('tsx scripts/verify-extension-bundle-size.ts chrome firefox');
    });

    it('builds the lazy content feature entry together with Reader so heavy renderer code can be shared', () => {
        for (const target of ['chrome', 'firefox']) {
            const source = readFileSync(resolve(process.cwd(), `vite.config.${target}.reader.ts`), 'utf8');
            expect(source).toContain("base: './'");
            expect(source).toContain("reader: resolve(__dirname, 'src/runtimes/reader/entry.ts')");
            expect(source).toContain("'content-features': resolve(__dirname, 'src/runtimes/content/contentFeatures.ts')");
            expect(source).toContain("entryFileNames: '[name].js'");
            expect(source).toContain("chunkFileNames: 'content-feature-chunks/[name]-[hash].js'");
            expect(source).toContain("preserveEntrySignatures: 'exports-only'");
            expect(source).not.toContain('inlineDynamicImports: true');
        }
    });
});
