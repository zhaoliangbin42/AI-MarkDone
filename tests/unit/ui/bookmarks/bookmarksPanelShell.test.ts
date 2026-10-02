import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { createBookmarksPanelShell } from '@/ui/content/bookmarks/ui/BookmarksPanelShell';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { beginSurfaceMotionClose, setSurfaceMotionOpening } from '@/ui/content/components/motionLifecycle';

describe('BookmarksPanelShell', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });
    it('settles opening motion when fullscreen is clicked immediately, then closes with fullscreen fade motion', () => {
        const callbacks = new Map<number, FrameRequestCallback>();
        let nextId = 1;
        const schedule = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
            const id = nextId++;
            callbacks.set(id, callback);
            return id;
        });
        const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
        const shell = createBookmarksPanelShell({ titleText: 'Library', closeIcon: '<svg/>', closeLabel: 'Close', defaultTabId: 'bookmarks', tabs: [
            { id: 'bookmarks', label: 'Library', icon: '<svg/>', content: document.createElement('div') },
        ] });
        document.body.append(shell.panel);
        setSurfaceMotionOpening([shell.panel]);
        expect(shell.panel.style.transform).toContain('translate');
        shell.panel.querySelector<HTMLButtonElement>('[data-action="workspace-fullscreen"]')!.click();
        expect(shell.panel.style.transform).toBe('');
        expect(shell.panel.dataset.motionState).toBe('open');
        expect(callbacks.size).toBe(0);
        const onClosed = vi.fn();
        beginSurfaceMotionClose({ shell: shell.panel, onClosed });
        expect(shell.panel.dataset.fullscreen).toBe('1');
        expect(shell.panel.dataset.motionState).toBe('closing');
        shell.panel.querySelector<HTMLButtonElement>('[data-action="workspace-fullscreen"]')!.click();
        expect(shell.panel.dataset.fullscreen).toBe('1');
        expect(shell.panel.dataset.motionState).toBe('closing');
        expect(getBookmarksPanelCss()).toContain('.panel-window--bookmarks[data-fullscreen="1"][data-motion-state="closing"]');
        shell.panel.dispatchEvent(new Event('animationend'));
        expect(onClosed).toHaveBeenCalledOnce();
        shell.panel.remove();
        schedule.mockRestore();
        cancel.mockRestore();
    });
    it('scrolls categories and information links together while only promotions stay at the bottom', () => {
        const navigation = document.createElement('div');
        navigation.className = 'settings-category-navigation';
        navigation.innerHTML = '<button data-category="reading">Reading</button>';
        const ids = ['bookmarks', 'settings', 'features', 'changelog', 'faq', 'about', 'feedback', 'mappamory', 'sponsor'];
        const shell = createBookmarksPanelShell({ titleText: 'Settings', closeIcon: '<svg/>', closeLabel: 'Close', defaultTabId: 'settings', tabs: ids.map(id => ({
            id, label: id, icon: '<svg/>', content: document.createElement('div'), navigation: id === 'settings' ? navigation : undefined,
        })) });
        const scroll = shell.panel.querySelector('.settings-navigation-scroll');
        const promotions = shell.panel.querySelector('.library-info-featured-links');
        expect(scroll?.contains(navigation)).toBe(true);
        expect(Array.from(scroll!.querySelectorAll<HTMLElement>('[data-tab-id]')).map(button => button.dataset.tabId)).toEqual(['features', 'changelog', 'faq', 'about', 'feedback']);
        expect(Array.from(promotions!.querySelectorAll<HTMLElement>('[data-tab-id]')).map(button => button.dataset.tabId)).toEqual(['mappamory', 'sponsor']);
        expect(promotions?.closest('#aimd-settings-navigation')).toBeNull();
        shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="bookmarks"]')!.click();
        expect(promotions?.closest('[inert]')).toBeNull();
        expect(scroll?.closest('[inert]')).toBeTruthy();
    });

    it('enters and exits workspace fullscreen through embedded corner actions without replacing navigation or content', () => {
        const navigation = document.createElement('div');
        navigation.className = 'settings-category-navigation';
        navigation.innerHTML = '<button data-category="reading" aria-pressed="true">Reading</button>';
        const content = document.createElement('div');
        const search = document.createElement('input');
        search.value = 'formula';
        content.append(search);
        const onFullscreenChange = vi.fn();
        const shell = createBookmarksPanelShell({ titleText: 'Settings', closeIcon: '<svg/>', closeLabel: 'Close', defaultTabId: 'settings', onFullscreenChange, tabs: [
            { id: 'bookmarks', label: 'Library', icon: '<svg/>', content: document.createElement('div') },
            { id: 'settings', label: 'Settings', icon: '<svg/>', content, navigation },
        ] });
        const corner = shell.panel.querySelector('.workspace-corner-actions');
        const fullscreen = corner?.querySelector<HTMLButtonElement>('[data-action="workspace-fullscreen"]');
        expect(fullscreen).toBeTruthy();
        expect(corner?.contains(shell.closeBtn)).toBe(true);
        expect(shell.panel.querySelectorAll('[data-action="close"]')).toHaveLength(1);
        expect(shell.headerActions.contains(shell.closeBtn)).toBe(true);
        expect(shell.panel.querySelector('footer')).toBeNull();
        content.scrollTop = 137;
        fullscreen!.click();
        expect(shell.panel.dataset.fullscreen).toBe('1');
        expect(fullscreen!.getAttribute('aria-pressed')).toBe('true');
        expect(onFullscreenChange).toHaveBeenLastCalledWith(true);
        expect(shell.panel.querySelector('input')).toBe(search);
        expect(search.value).toBe('formula');
        expect(content.scrollTop).toBe(137);
        expect(shell.panel.querySelector('.settings-category-navigation')).toBe(navigation);
        fullscreen!.click();
        expect(shell.panel.dataset.fullscreen).toBe('0');
        expect(fullscreen!.getAttribute('aria-pressed')).toBe('false');
        expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
    });
    it('keeps information destinations visible and clears the category selection through the actual tab trigger', () => {
        const navigation = document.createElement('div');
        navigation.innerHTML = '<button data-category="reading" data-active="true" aria-pressed="true">Reading</button>';
        const shell = createBookmarksPanelShell({titleText:'Library',closeIcon:'<svg/>',closeLabel:'Close',defaultTabId:'settings',tabs:[
            {id:'bookmarks',label:'Library',icon:'<svg/>',content:document.createElement('div')},
            {id:'settings',label:'Settings',icon:'<svg/>',content:document.createElement('div'),navigation},
            {id:'about',label:'About',icon:'<svg/>',content:document.createElement('div')},
        ]});
        const about = shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="about"]')!;
        expect(about.closest('details')).toBeNull();
        about.click();
        expect(navigation.firstElementChild?.getAttribute('aria-pressed')).toBe('false');
        expect(about.getAttribute('aria-pressed')).toBe('true');
    });
    it('fills the available panel height and keeps bulk controls hidden until requested', () => {
        const css = getBookmarksPanelCss();
        expect(css).toMatch(/\.bookmarks-shell\s*\{[^}]*flex:\s*1;/);
        expect(css).toContain('.batch-bar[hidden]');
    });
    it('keeps title metadata hidden and embeds the actions without a visible header or footer bar', () => {
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

        const header = shell.panel.querySelector<HTMLElement>('.workspace-title-metadata');
        const meta = shell.panel.querySelector('.panel-header__meta');
        const actions = shell.panel.querySelector('.workspace-corner-actions');
        const title = shell.panel.querySelector('.panel-header__meta h2');

        expect(header).toBeTruthy();
        expect(meta).toBeTruthy();
        expect(actions).toBeTruthy();
        expect(header?.hidden).toBe(true);
        expect(shell.panel.querySelector('.panel-header')).toBeNull();
        expect(meta?.contains(shell.title)).toBe(true);
        expect(actions?.contains(shell.closeBtn)).toBe(true);
        expect(shell.panel.querySelector('.workspace-corner-actions')?.contains(shell.closeBtn)).toBe(true);
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

    it('switches through module buttons without replacing navigation or panels', () => {
        const navigation = document.createElement('div');
        const content = document.createElement('div');
        const shell = createBookmarksPanelShell({ titleText: 'Library', closeIcon: '<svg/>', closeLabel: 'Close', defaultTabId: 'bookmarks', tabs: [
            { id: 'bookmarks', label: 'Library', icon: '<svg/>', content, navigation },
            { id: 'settings', label: 'Settings', icon: '<svg/>', content: document.createElement('div') },
        ] });
        const libraryNav = shell.panel.querySelector('#aimd-library-navigation')!;
        const settingsButton = shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="settings"]')!;
        const beforeChange = vi.fn(() => expect(content.parentElement?.hidden).toBe(false));
        shell.tabs.getElement().addEventListener('aimd:tabs-before-change', beforeChange, { once: true });
        settingsButton.click();
        expect(beforeChange).toHaveBeenCalledOnce();
        expect(libraryNav.hasAttribute('inert')).toBe(true);
        expect(settingsButton.getAttribute('aria-expanded')).toBe('true');
        shell.panel.querySelector<HTMLButtonElement>('[data-tab-id="bookmarks"]')!.click();
        expect(libraryNav.firstElementChild).toBe(navigation);
        expect(libraryNav.hasAttribute('inert')).toBe(false);
        expect(content.parentElement?.hidden).toBe(false);
        expect(getBookmarksPanelCss()).toContain('prefers-reduced-motion');
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
