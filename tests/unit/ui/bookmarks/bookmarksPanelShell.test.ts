import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createBookmarksPanelShell } from '@/ui/content/bookmarks/ui/BookmarksPanelShell';

describe('BookmarksPanelShell', () => {
    it('creates dedicated header meta and actions wrappers instead of overloading the header element', () => {
        const content = document.createElement('div');
        const shell = createBookmarksPanelShell({
            titleText: 'Bookmarks',
            closeIcon: '<svg></svg>',
            closeLabel: 'Close',
            tabs: [
                {
                    id: 'bookmarks',
                    label: 'Bookmarks',
                    icon: '<svg></svg>',
                    content,
                },
            ],
            defaultTabId: 'bookmarks',
        });

        const header = shell.panel.querySelector('.panel-header');
        const meta = shell.panel.querySelector('.panel-header__meta');
        const actions = shell.panel.querySelector('.panel-header__actions');
        const title = shell.panel.querySelector('.panel-header__meta h2');

        expect(header).toBeTruthy();
        expect(meta).toBeTruthy();
        expect(actions).toBeTruthy();
        expect(header?.classList.contains('panel-header__meta')).toBe(false);
        expect(header?.classList.contains('panel-header__actions')).toBe(false);
        expect(meta?.contains(shell.title)).toBe(true);
        expect(actions?.contains(shell.closeBtn)).toBe(true);
        expect(title?.textContent).toBe('Bookmarks');
    });

    it('uses the mock shell structure with sidebar tab buttons and tab panels instead of the legacy Tabs component DOM', () => {
        const bookmarks = document.createElement('div');
        const settings = document.createElement('div');
        const shell = createBookmarksPanelShell({
            titleText: 'Bookmarks',
            closeIcon: '<svg></svg>',
            closeLabel: 'Close',
            tabs: [
                {
                    id: 'bookmarks',
                    label: 'Bookmarks',
                    icon: '<svg></svg>',
                    content: bookmarks,
                    panelClassName: 'tab-panel--bookmarks',
                },
                {
                    id: 'settings',
                    label: 'Settings',
                    icon: '<svg></svg>',
                    content: settings,
                    panelClassName: 'settings-panel',
                },
            ],
            defaultTabId: 'bookmarks',
        });

        const root = shell.tabs.getElement();
        const sidebar = root.querySelector('.bookmarks-sidebar');
        const body = root.querySelector('.bookmarks-body');
        const buttons = root.querySelectorAll('.tab-btn');
        const panels = root.querySelectorAll('.tab-panel');

        expect(root.classList.contains('bookmarks-shell')).toBe(true);
        expect(root.querySelector('.aimd-tabs')).toBeFalsy();
        expect(sidebar).toBeTruthy();
        expect(body).toBeTruthy();
        expect(buttons).toHaveLength(2);
        expect(panels).toHaveLength(2);
        expect(bookmarks.dataset.active).toBe('1');
        expect(settings.dataset.active).toBe('0');

        shell.tabs.setActive('settings');

        expect(bookmarks.dataset.active).toBe('0');
        expect(settings.dataset.active).toBe('1');
    });

    it('keeps the mobile tab rail as three equal columns without stretching the whole rail vertically', () => {
        const css = fs.readFileSync(
            path.join(process.cwd(), 'src/ui/content/bookmarks/ui/styles/bookmarksPanelCss.ts'),
            'utf8',
        );

        expect(css).toContain('.bookmarks-sidebar {');
        expect(css).toContain('display: grid;');
        expect(css).toContain('width: 100%;');
        expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
        expect(css).toContain('grid-template-rows: auto minmax(0, 1fr);');
        expect(css).not.toContain('width: auto;');
    });

    it('is the only shell source of truth used by BookmarksPanel', () => {
        const source = fs.readFileSync(
            path.join(process.cwd(), 'src/ui/content/bookmarks/BookmarksPanel.ts'),
            'utf8',
        );

        expect(source).toContain('createBookmarksPanelShell');
        expect(source).not.toContain('function getPanelHtml(');
        expect(source).not.toContain('getPanelHtml(');
    });
});
