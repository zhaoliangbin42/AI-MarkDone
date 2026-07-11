import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production build minification', () => {
    it('keeps every extension runtime build on the same explicit esbuild minifier', () => {
        const repoRoot = process.cwd();
        const configFiles = readdirSync(repoRoot)
            .filter((name) => /^vite\.config(?:\.(?:chrome|firefox|safari)(?:\.(?:background|reader|formula-renderer))?)?\.ts$/.test(name))
            .sort();

        expect(configFiles).toHaveLength(13);
        for (const configFile of configFiles) {
            const source = readFileSync(resolve(repoRoot, configFile), 'utf8');
            expect(source, configFile).toContain("minify: 'esbuild'");
            expect(source, configFile).toContain("charset: 'ascii'");
            expect(source, configFile).not.toContain('minify: false');
        }
    });

    it('enforces bundle budgets at the end of each browser build command', () => {
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };

        expect(pkg.scripts.build).toContain('npm run verify:bundle-size');
        expect(pkg.scripts['build:safari:webext']).toContain('npm run verify:bundle-size:safari');
        expect(pkg.scripts['verify:bundle-size']).toBe('tsx scripts/verify-extension-bundle-size.ts chrome firefox');
        expect(pkg.scripts['verify:bundle-size:safari']).toBe('tsx scripts/verify-extension-bundle-size.ts safari');
    });
});
