import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPPORTED_HOST_PATTERNS } from '../../../config/extension/hosts';

type ChromeManifest = {
    host_permissions?: string[];
    content_scripts?: Array<{ matches?: string[] }>;
};

type FirefoxManifest = {
    permissions?: string[];
    content_scripts?: Array<{ matches?: string[] }>;
};

type PackageJson = {
    scripts?: Record<string, string>;
};

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8')) as T;
}

function normalizeHosts(patterns: string[]): string[] {
    return Array.from(
        new Set(
            patterns
                .filter((value) => /^https?:\/\//.test(value))
                .map((value) => new URL(value.replace('*://', 'https://').replace('/*', '/')).hostname),
        ),
    ).sort();
}

function popupHosts(): string[] {
    const html = readFileSync(resolve(process.cwd(), 'src/popup/popup.html'), 'utf-8');
    const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1]);
    return Array.from(new Set(hrefs.map((href) => new URL(href).hostname))).sort();
}

describe('supported hosts consistency', () => {
    it('keeps manifest hosts aligned across chrome, firefox, and content scripts while allowing the popup to show a curated subset', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<FirefoxManifest>('manifest.firefox.json');
        const safari = readJson<FirefoxManifest>('manifest.safari.json');

        const sourceHosts = normalizeHosts([...SUPPORTED_HOST_PATTERNS]);
        const chromeHosts = normalizeHosts(chrome.host_permissions || []);
        const firefoxHosts = normalizeHosts((firefox.permissions || []).filter((value) => value.startsWith('http')));
        const safariHosts = normalizeHosts((safari.permissions || []).filter((value) => value.startsWith('http')));
        const chromeContentHosts = normalizeHosts(chrome.content_scripts?.flatMap((entry) => entry.matches || []) || []);
        const firefoxContentHosts = normalizeHosts(firefox.content_scripts?.flatMap((entry) => entry.matches || []) || []);
        const safariContentHosts = normalizeHosts(safari.content_scripts?.flatMap((entry) => entry.matches || []) || []);
        const popupLinkHosts = popupHosts();

        expect(sourceHosts).toEqual(chromeHosts);
        expect(chromeHosts).toEqual(firefoxHosts);
        expect(chromeHosts).toEqual(safariHosts);
        expect(chromeHosts).toEqual(chromeContentHosts);
        expect(chromeHosts).toEqual(firefoxContentHosts);
        expect(chromeHosts).toEqual(safariContentHosts);
        expect(popupLinkHosts.length).toBeGreaterThan(0);
        expect(popupLinkHosts.every((host) => chromeHosts.includes(host))).toBe(true);
    });

    it('defines an acceptance gate script for release-level parity checks', () => {
        const pkg = readJson<PackageJson>('package.json');
        const acceptance = pkg.scripts?.['test:acceptance'];

        expect(typeof acceptance).toBe('string');
        expect(acceptance).toContain('supported-hosts-consistency.test.ts');
    });
});
