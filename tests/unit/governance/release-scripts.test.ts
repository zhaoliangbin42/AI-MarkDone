import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type PackageJson = {
    scripts?: Record<string, string>;
};

function readPackageJson(): PackageJson {
    return JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8')) as PackageJson;
}

function readReleaseGuide(): string {
    return readFileSync(resolve(process.cwd(), '.codex/guides/release.md'), 'utf-8');
}

function readSafariDmgScript(): string {
    return readFileSync(resolve(process.cwd(), 'scripts/package-safari-dmg.ts'), 'utf-8');
}

describe('release scripts', () => {
    it('runs all automated release gates including Safari web extension build', () => {
        const scripts = readPackageJson().scripts || {};

        expect(scripts['release:verify']).toContain('npm run test:smoke');
        expect(scripts['release:verify']).toContain('npm run test:acceptance');
        expect(scripts['release:verify']).toContain('npm run build:all:webext');
        expect(scripts['release:verify']).not.toContain('npm run test:core');
    });

    it('keeps Safari Xcode packaging as an explicit manual command', () => {
        const scripts = readPackageJson().scripts || {};
        const releaseGuide = readReleaseGuide();

        expect(scripts['package:safari:xcode']).toContain('npm run build:safari:webext');
        expect(scripts['package:safari:xcode']).toContain('xcrun safari-web-extension-converter dist-safari');
        expect(scripts['package:safari:xcode']).toContain('--copy-resources');
        expect(scripts['package:safari:xcode']).toContain('--no-open');
        expect(scripts['package:safari:xcode']).toContain('--no-prompt');
        expect(scripts['package:safari:xcode']).toContain('--force');
        expect(scripts['release:verify']).not.toContain('package:safari:xcode');
        expect(releaseGuide).toContain('npm run package:safari:xcode');
        expect(releaseGuide).toContain('Every explicit release flow must run Safari Xcode packaging');
    });

    it('keeps Safari DMG packaging in the explicit release flow', () => {
        const scripts = readPackageJson().scripts || {};
        const releaseGuide = readReleaseGuide();

        expect(scripts['package:safari:dmg']).toBe('tsx scripts/package-safari-dmg.ts');
        expect(scripts['release:verify']).not.toContain('package:safari:dmg');
        expect(releaseGuide).toContain('npm run package:safari:dmg');
        expect(releaseGuide).toContain('SAFARI_APP_PATH');
        expect(releaseGuide).toContain('App Store Connect');
    });

    it('keeps formal release artifacts under the release directory', () => {
        const releaseGuide = readReleaseGuide();
        const safariDmgScript = readSafariDmgScript();

        expect(releaseGuide).toContain('release/AI-MarkDone-v<version>-free.dmg');
        expect(releaseGuide).toContain('release/AI-MarkDone-v<version>-<target>.zip');
        expect(releaseGuide).toContain('Do not place formal release packages under `release-artifacts/`');
        expect(safariDmgScript).toContain('release/${productName}-v${version}-free.dmg');
    });
});
