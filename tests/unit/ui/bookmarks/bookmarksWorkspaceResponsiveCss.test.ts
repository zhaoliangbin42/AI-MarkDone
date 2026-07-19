import { describe, expect, it } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { getBookmarksWorkspaceResponsiveCss } from '@/ui/content/bookmarks/ui/styles/bookmarksWorkspaceResponsiveCss';

describe('Bookmarks workspace responsive family styles', () => {
    it('owns the workspace 980/720/560 contracts and composes them into the shipped family stylesheet', () => {
        const responsiveCss = getBookmarksWorkspaceResponsiveCss();
        const shippedCss = getBookmarksPanelCss();

        expect(responsiveCss).toContain('@media (max-width: 980px)');
        expect(responsiveCss).toContain('@media (max-width: 720px)');
        expect(responsiveCss).toContain('@media (max-width: 560px)');
        expect(responsiveCss).toContain('.bookmarks-shell');
        expect(responsiveCss).toContain('.settings-panel-scroll');
        expect(responsiveCss).toContain('.settings-row');
        expect(shippedCss).toContain(responsiveCss.trim());
    });

    it('keeps the bookmark toolbar and row content readable without hiding touch actions at phone widths', () => {
        const responsiveCss = getBookmarksWorkspaceResponsiveCss();

        expect(responsiveCss).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.toolbar-row--bookmarks > \.toolbar-actions\s*\{[\s\S]*?justify-content: flex-start;[\s\S]*?flex-wrap: wrap;/);
        expect(responsiveCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.tree-item\s*\{[\s\S]*?padding-right: var\(--aimd-space-2\);/);
        expect(responsiveCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.tree-title-meta\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
        expect(responsiveCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.tree-item\[data-selected="1"\] \.tree-actions[\s\S]*?display: inline-flex;/);
    });

    it('reserves enough desktop row space for every bookmark action', () => {
        const shippedCss = getBookmarksPanelCss();

        expect(shippedCss).toContain('var(--aimd-size-control-icon-panel) * 5');
    });

    it('keeps community QR codes large and stacks them into one scan-friendly column on narrow layouts', () => {
        const responsiveCss = getBookmarksWorkspaceResponsiveCss();
        const shippedCss = getBookmarksPanelCss();

        expect(shippedCss).toMatch(/\.community-group-card__image-frame\s*\{[\s\S]*?aspect-ratio: 9 \/ 16;/);
        expect(shippedCss).toMatch(/\.community-group-card__image\s*\{[\s\S]*?object-fit: contain;/);
        expect(shippedCss).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.community-group-grid\s*\{[\s\S]*?grid-template-columns: 1fr;/);
        expect(responsiveCss).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.community-card\s*\{[\s\S]*?padding: var\(--aimd-space-4\);/);
    });
});
