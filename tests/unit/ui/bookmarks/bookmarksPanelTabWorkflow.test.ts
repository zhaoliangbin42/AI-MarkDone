import { describe, expect, it, vi } from 'vitest';
import { BookmarksPanelTabWorkflow } from '@/ui/content/bookmarks/workflows/BookmarksPanelTabWorkflow';

function createContents(): Record<'bookmarks' | 'settings' | 'features' | 'changelog' | 'about' | 'mappamory' | 'faq' | 'sponsor' | 'feedback', HTMLElement> {
    return {
        bookmarks: document.createElement('section'),
        settings: document.createElement('section'),
        features: document.createElement('section'),
        changelog: document.createElement('section'),
        about: document.createElement('section'),
        mappamory: document.createElement('section'),
        faq: document.createElement('section'),
        sponsor: document.createElement('section'),
        feedback: document.createElement('section'),
    };
}

describe('BookmarksPanelTabWorkflow', () => {
    it('owns enabled-tab normalization, labels, order, and shell specs', () => {
        const workflow = new BookmarksPanelTabWorkflow({ sponsorEnabled: false });
        const translate = vi.fn((_key: string, fallback: string) => fallback);

        expect(workflow.getActiveTab()).toBe('bookmarks');
        expect(workflow.select('sponsor')).toBe(false);
        expect(workflow.getActiveTab()).toBe('bookmarks');
        expect(workflow.select('settings')).toBe(true);

        const model = workflow.createShellModel({
            contents: createContents(),
            translate,
        });

        expect(model.titleText).toBe('Settings');
        expect(model.tabs.map((tab) => tab.id)).toEqual([
            'bookmarks',
            'settings',
            'features',
            'changelog',
            'faq',
            'about',
            'mappamory',
            'feedback',
        ]);
        expect(model.tabs.some((tab) => tab.id === 'sponsor')).toBe(false);
    });

    it('keeps scroll ownership with the active tab across shell recreation', () => {
        const workflow = new BookmarksPanelTabWorkflow({ sponsorEnabled: true });
        const surfaceRoot = document.createElement('div');
        const settingsScroll = document.createElement('div');
        settingsScroll.className = 'settings-panel-scroll';
        surfaceRoot.appendChild(settingsScroll);
        const navigationScroll = document.createElement('div');
        navigationScroll.className = 'settings-navigation-scroll';
        surfaceRoot.append(navigationScroll);

        expect(workflow.select('settings')).toBe(true);
        settingsScroll.scrollTop = 184;
        navigationScroll.scrollTop = 91;
        workflow.captureScrollPositions(surfaceRoot, null);
        settingsScroll.scrollTop = 0;
        navigationScroll.scrollTop = 0;
        workflow.restoreActiveScrollPosition(surfaceRoot, null);

        expect(settingsScroll.scrollTop).toBe(184);
        expect(navigationScroll.scrollTop).toBe(91);

        const bookmarksView = {
            getTreeScrollTop: vi.fn(() => 96),
            restoreTreeScroll: vi.fn(),
        };
        expect(workflow.select('bookmarks')).toBe(true);
        workflow.captureScrollPositions(surfaceRoot, bookmarksView);
        workflow.restoreActiveScrollPosition(surfaceRoot, bookmarksView);
        expect(bookmarksView.restoreTreeScroll).toHaveBeenCalledWith(96);
    });

    it('does not overwrite a saved position with an inactive hidden panel', () => {
        const workflow = new BookmarksPanelTabWorkflow({ sponsorEnabled: true });
        const root = document.createElement('div');
        const settings = document.createElement('div');
        settings.className = 'settings-panel-scroll';
        const features = document.createElement('div');
        features.className = 'features-panel';
        root.append(settings, features);
        workflow.select('settings');
        settings.scrollTop = 146;
        workflow.captureScrollPositions(root, null);
        workflow.select('features');
        settings.scrollTop = 0;
        features.scrollTop = 58;
        workflow.captureScrollPositions(root, null);
        workflow.select('settings');
        workflow.restoreActiveScrollPosition(root, null);
        expect(settings.scrollTop).toBe(146);
    });
});
