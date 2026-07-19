import { describe, expect, it, vi } from 'vitest';
import { BookmarksPanelTabWorkflow } from '@/ui/content/bookmarks/workflows/BookmarksPanelTabWorkflow';

function createContents(): Record<'bookmarks' | 'settings' | 'changelog' | 'about' | 'mappamory' | 'faq' | 'sponsor' | 'feedback', HTMLElement> {
    return {
        bookmarks: document.createElement('section'),
        settings: document.createElement('section'),
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

        expect(workflow.select('settings')).toBe(true);
        settingsScroll.scrollTop = 184;
        workflow.captureScrollPositions(surfaceRoot, null);
        settingsScroll.scrollTop = 0;
        workflow.restoreActiveScrollPosition(surfaceRoot, null);

        expect(settingsScroll.scrollTop).toBe(184);

        const bookmarksView = {
            getTreeScrollTop: vi.fn(() => 96),
            restoreTreeScroll: vi.fn(),
        };
        expect(workflow.select('bookmarks')).toBe(true);
        workflow.captureScrollPositions(surfaceRoot, bookmarksView);
        workflow.restoreActiveScrollPosition(surfaceRoot, bookmarksView);
        expect(bookmarksView.restoreTreeScroll).toHaveBeenCalledWith(96);
    });
});
