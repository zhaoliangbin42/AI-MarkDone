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

describe('release scripts', () => {
    it('runs all automated release gates for Chrome and Firefox', () => {
        const scripts = readPackageJson().scripts || {};

        expect(scripts['release:verify']).toContain('npm run test:smoke');
        expect(scripts['release:verify']).toContain('npm run test:acceptance');
        expect(scripts['release:verify']).toContain('npm run build');
        expect(scripts['release:verify']).not.toContain('npm run test:core');
        expect(scripts.build).toContain('npm run build:chrome');
        expect(scripts.build).toContain('npm run build:firefox');
        expect(scripts['release:verify']).not.toContain('safari');
    });

    it('keeps Safari outside the supported release workflow', () => {
        const scripts = readPackageJson().scripts || {};
        const releaseGuide = readReleaseGuide();

        expect(scripts['release:verify']).not.toContain('safari');
        expect(releaseGuide).not.toContain('package:safari');
        expect(releaseGuide).not.toContain('SAFARI_APP_PATH');
        expect(releaseGuide).not.toContain('App Store Connect');
    });

    it('keeps formal release artifacts under the release directory', () => {
        const releaseGuide = readReleaseGuide();

        expect(releaseGuide).toContain('release/AI-MarkDone-v<version>-<target>.zip');
        expect(releaseGuide).toContain('Do not place formal release packages under `release-artifacts/`');
    });
});
