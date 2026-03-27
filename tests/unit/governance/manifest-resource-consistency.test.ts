import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ChromeManifest = {
    host_permissions?: string[];
    icons?: Record<string, string>;
    action?: { default_icon?: Record<string, string> };
    web_accessible_resources?: Array<{ resources?: string[]; matches?: string[] }>;
};

type FirefoxManifest = {
    icons?: Record<string, string>;
    browser_action?: { default_icon?: Record<string, string> };
    web_accessible_resources?: string[];
};

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8')) as T;
}

function normalized(values: string[] | undefined): string[] {
    return Array.from(new Set(values || [])).sort();
}

describe('manifest resource consistency', () => {
    it('web_accessible_resources should stay aligned across chrome/firefox manifests', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<FirefoxManifest>('manifest.firefox.json');

        const chromeResources = normalized(chrome.web_accessible_resources?.[0]?.resources);
        const firefoxResources = normalized(firefox.web_accessible_resources);

        expect(chromeResources.length).toBeGreaterThan(0);
        expect(chromeResources).toEqual(firefoxResources);
    });

    it('chrome web_accessible_resources matches should align with host permissions', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const resourceMatches = normalized(chrome.web_accessible_resources?.[0]?.matches);
        const hostPermissions = normalized(chrome.host_permissions);

        expect(resourceMatches.length).toBeGreaterThan(0);
        expect(resourceMatches).toEqual(hostPermissions);
    });

    it('toolbar/action icon paths should stay aligned across manifests', () => {
        const chrome = readJson<ChromeManifest>('manifest.chrome.json');
        const firefox = readJson<FirefoxManifest>('manifest.firefox.json');

        const chromeIcons = chrome.action?.default_icon || {};
        const firefoxIcons = firefox.browser_action?.default_icon || {};

        expect(chromeIcons).toEqual(firefoxIcons);
        expect(chrome.icons).toEqual(firefox.icons);
    });

    it('default manifests should not expose ChatGPT early-prune entrypoints', () => {
        const chrome = readJson<ChromeManifest & { content_scripts?: Array<{ js?: string[]; run_at?: string }> }>('manifest.chrome.json');
        const firefox = readJson<FirefoxManifest & { content_scripts?: Array<{ js?: string[]; run_at?: string }> }>('manifest.firefox.json');

        const chromeScripts = chrome.content_scripts?.flatMap((item) => item.js || []) || [];
        const firefoxScripts = firefox.content_scripts?.flatMap((item) => item.js || []) || [];
        const chromeResources = normalized(chrome.web_accessible_resources?.[0]?.resources);
        const firefoxResources = normalized(firefox.web_accessible_resources);

        expect(chromeScripts).not.toContain('content-early.js');
        expect(firefoxScripts).not.toContain('content-early.js');
        expect(chromeResources).not.toContain('content-early-main.js');
        expect(firefoxResources).not.toContain('content-early-main.js');
    });
});
