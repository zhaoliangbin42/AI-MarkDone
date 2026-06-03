import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/drivers/shared/clients/settingsClientRpc', () => ({
    settingsClientRpc: {
        getAll: vi.fn(async () => ({
            ok: true,
            data: {
                settings: {
                    platforms: { chatgpt: true },
                    behavior: {
                        showSaveMessages: true,
                        showWordCount: true,
                        enableClickToCopy: true,
                        saveContextOnly: true,
                        _contextOnlyConfirmed: true,
                    },
                    reader: { renderCodeInReader: true },
                    language: 'auto',
                },
            },
        })),
        setCategory: vi.fn(async () => ({ ok: true, data: { category: 'platforms' } })),
    },
}));

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({
    bookmarksClient: {
        getChangelogNotice: vi.fn(async () => ({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: null,
                reason: null,
                previousVersion: null,
            },
        })),
        ackChangelogNotice: vi.fn(async () => ({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: '4.1.2',
                reason: null,
                previousVersion: '4.1.0',
            },
        })),
    },
}));

vi.mock('@/config/targetSurface', () => ({
    TARGET_SURFACE_SPONSOR_TAB_ENABLED: false,
    TARGET_SURFACE_SOCIAL_FOLLOW_CARD_ENABLED: false,
    targetSurfacePolicy: {
        sponsorTab: false,
        socialFollowCard: false,
    },
}));

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createController(): any {
    const snapshot = {
        vm: {
            query: '',
            platform: 'All',
            bookmarks: [],
            folderTree: [],
            selectedFolderPath: null,
            sortMode: 'time-desc',
        },
        folders: [],
        folderPaths: [],
        selectedKeys: new Set(),
        previewId: null,
        status: 'Ready',
    };

    return {
        subscribe: vi.fn((fn: (snap: any) => void) => {
            fn(snapshot);
            return () => {};
        }),
        refreshAll: vi.fn(async () => undefined),
        refreshPositionsForUrl: vi.fn(async () => undefined),
        refreshUiState: vi.fn(async () => undefined),
        getTheme: vi.fn(() => 'light'),
        getPlatforms: vi.fn(() => ['All', 'ChatGPT']),
        getFolderCheckboxState: vi.fn(() => ({ checked: false, indeterminate: false })),
        setQuery: vi.fn(),
        setPlatform: vi.fn(),
        setSortMode: vi.fn(),
        toggleFolderExpanded: vi.fn(),
        toggleFolderSelection: vi.fn(),
        toggleBookmarkSelection: vi.fn(),
        selectFolder: vi.fn(),
        getBookmarkRowSubtitle: vi.fn(() => 'ChatGPT - today'),
        exportAll: vi.fn(async () => ({ ok: true, data: { payload: {} } })),
        setPanelStatus: vi.fn(),
    };
}

describe('BookmarksPanel Safari App Store surface policy', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('omits sponsor and social-follow surfaces while keeping the normal info tabs', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: any) => {
                const target = String(url);
                if (target.includes('_locales/zh_CN/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('zh_CN') } as any;
                }
                if (target.includes('_locales/en/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('en') } as any;
                }
                return { ok: false, json: async () => ({}) } as any;
            }),
        );

        const { BookmarksPanel } = await import('@/ui/content/bookmarks/BookmarksPanel');
        const panel = new BookmarksPanel(createController(), { show: vi.fn(), hide: vi.fn() } as any);
        await panel.show();

        const shadow = document.getElementById('aimd-bookmarks-panel-host')!.shadowRoot!;
        const tabIds = Array.from(shadow.querySelectorAll<HTMLElement>('[data-action="set-bookmarks-tab"]')).map((node) => node.dataset.tab);
        expect(tabIds).toEqual(['bookmarks', 'settings', 'changelog', 'faq', 'about']);
        expect(shadow.querySelector('[data-action="set-bookmarks-tab"][data-tab="sponsor"]')).toBeNull();
        expect(shadow.querySelector('.sponsor-panel')).toBeNull();
        expect(shadow.textContent).not.toContain('Buy Me Coffee');

        shadow.querySelector<HTMLElement>('[data-action="set-bookmarks-tab"][data-tab="about"]')!.click();
        const aboutPanel = shadow.querySelector<HTMLElement>('.about-panel');
        expect(aboutPanel?.dataset.active).toBe('1');
        expect(aboutPanel?.querySelector('.aimd-about')).toBeTruthy();
        expect(aboutPanel?.querySelector('.info-profile__avatar')).toBeTruthy();
        expect(aboutPanel?.querySelector<HTMLAnchorElement>('.support-contact-card__button--email')?.href).toBe(
            'mailto:zhaoliangbin42@gmail.com?subject=AI-MarkDone%20Safari%20Feedback',
        );
        expect(aboutPanel?.querySelector<HTMLButtonElement>('[data-action="copy-support-email"]')?.textContent?.trim()).toBe('Copy Email');
        expect(aboutPanel?.querySelector('.social-follow-card')).toBeNull();
        expect(aboutPanel?.textContent).toContain('Feedback and contact');

        panel.hide();
    });
});
