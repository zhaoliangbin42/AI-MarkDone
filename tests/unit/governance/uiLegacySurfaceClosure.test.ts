import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');

function read(relativePath: string): string {
    return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('legacy UI surface closure', () => {
    it('does not bundle the production-dead Send modal beside the Reader Send popover', () => {
        expect(existsSync(resolve(repoRoot, 'src/ui/content/sending/SendModal.ts'))).toBe(false);

        const controller = read('src/ui/content/sending/SendController.ts');
        expect(controller).not.toContain("from './SendModal'");
        expect(controller).not.toContain('new SendModal');
        expect(controller).not.toMatch(/\bmodal\.(?:open|close|isOpen|setAppearance)\b/);

        const runtime = read('src/runtimes/content/entry.ts');
        expect(runtime).not.toContain('sendController.open(');
    });

    it('does not retain unused generic Tabs or the no-op Markdown enhancer shim', () => {
        expect(existsSync(resolve(repoRoot, 'src/ui/content/components/Tabs.ts'))).toBe(false);
        expect(existsSync(resolve(repoRoot, 'src/ui/content/components/markdownEnhancer.ts'))).toBe(false);

        const productionSources = [
            'src/runtimes/content/entry.ts',
            'src/runtimes/content/lazyContentFeatures.ts',
            'src/ui/content/reader/ReaderPanel.ts',
            'src/ui/content/bookmarks/BookmarksPanel.ts',
        ].map(read).join('\n');
        expect(productionSources).not.toContain('markdownEnhancer');
        expect(productionSources).not.toMatch(/(?:new\s+Tabs|from\s+['"][^'"]*\/Tabs['"])/);
    });

    it('does not retain the redrawn panel studio after real Reader and Bookmarks fixtures exist', () => {
        expect(existsSync(resolve(repoRoot, 'mocks/components/panel-studio/index.html'))).toBe(false);
        expect(existsSync(resolve(repoRoot, 'mocks/components/panel-studio/main.ts'))).toBe(false);
        expect(existsSync(resolve(repoRoot, 'tests/unit/ui/mocks/panelStudio.bookmarks.test.ts'))).toBe(false);

        expect(read('.gitignore')).not.toContain('mocks/components/panel-studio');
        expect(read('docs/design.md')).not.toContain('mocks/components/panel-studio');
    });

    it('does not retain the redrawn overlay token probe beside the real OverlaySession fixture', () => {
        expect(existsSync(resolve(repoRoot, 'src/ui/content/overlay/mock/OverlayThemeProbe.ts'))).toBe(false);
        const fixture = read('mocks/components/overlay-host/main.ts');
        expect(fixture).toContain('new OverlaySession');
        expect(fixture).not.toContain('OverlayThemeProbe');
    });

    it('keeps migrated Surface appearance on the single snapshot API', () => {
        for (const relativePath of [
            'src/ui/content/MessageToolbar.ts',
            'src/ui/content/components/FormulaComposerAssistantPopover.ts',
            'src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts',
            'src/ui/content/components/ToolbarHoverActionPortal.ts',
            'src/ui/content/controllers/ChatGPTPromptAutocompleteController.ts',
            'src/ui/content/controllers/FormulaAssetHoverController.ts',
            'src/ui/content/overlay/OverlaySession.ts',
            'src/ui/content/sending/SendPopover.ts',
        ]) {
            const source = read(relativePath);
            expect(source, relativePath).toContain('setAppearance(');
            expect(source, relativePath).not.toMatch(/\n\s*setTheme\(/);
            expect(source, relativePath).not.toMatch(/\n\s*setThemeOverrides\(/);
            expect(source, relativePath).not.toContain('this.state.theme');
        }
    });

    it('keeps toolbar hover transients on the transform-safe established lifecycle', () => {
        const portal = read('src/ui/content/components/ToolbarHoverActionPortal.ts');
        expect(portal).not.toContain('SurfaceSession');
        expect(portal).not.toContain('getAnchoredMotionCss');
        expect(portal).toContain('onDocPointerDown');
        expect(portal).toContain("document.addEventListener('pointerdown'");
        expect(portal).toContain('path.includes(this.host)');
        expect(portal).toContain('path.includes(this.currentAnchor)');
    });

    it('keeps the Prompt family split by workflow, geometry, rendering, and orchestration responsibility', () => {
        const controller = read('src/ui/content/controllers/ChatGPTPromptAutocompleteController.ts');
        const workflow = read('src/ui/content/prompts/PromptWorkflow.ts');
        const geometry = read('src/ui/content/prompts/PromptGeometryAdapter.ts');
        const renderer = read('src/ui/content/prompts/PromptSurfaceRenderer.ts');

        expect(controller).toContain('new PromptWorkflow');
        expect(controller).toContain('new PromptGeometryAdapter');
        expect(controller).toContain('new PromptSurfaceRenderer');
        expect(controller).not.toContain('.listPrompts(');
        expect(controller).not.toContain('getContenteditableCaretClientRect');
        expect(controller).not.toContain('.innerHTML =');
        expect(workflow).toContain('this.client.listPrompts');
        expect(geometry).toContain('getContenteditableCaretClientRect');
        expect(renderer).toContain('this.root.innerHTML =');
    });

    it('keeps the Directory controller on one appearance snapshot instead of shadow theme state', () => {
        const directory = read('src/ui/content/controllers/ChatGPTDirectoryController.ts');
        expect(directory).not.toMatch(/private theme(?:Overrides)?:/);
        expect(directory).not.toContain('this.themeOverrides =');
        expect(directory).not.toContain('this.theme = snapshot.theme');

        const rail = read('src/ui/content/chatgptDirectory/ChatGPTDirectoryRail.ts');
        expect(rail).toContain('AppearanceScope.forShadowRoot');
        expect(rail).not.toContain('getTokenCss(');
    });

    it('lets OverlaySession own dialog tokens without duplicate theme state or token CSS', () => {
        for (const relativePath of [
            'src/ui/content/bookmarks/save/BookmarkSaveDialog.ts',
            'src/ui/content/export/SaveMessagesDialog.ts',
        ]) {
            const source = read(relativePath);
            expect(source, relativePath).not.toContain('getTokenCss(');
            expect(source, relativePath).not.toMatch(/private theme(?:Overrides)?:/);
        }
    });

    it('mounts immutable overlay structure CSS once instead of rewriting it during render or appearance updates', () => {
        for (const relativePath of [
            'src/ui/content/bookmarks/save/BookmarkSaveDialog.ts',
            'src/ui/content/export/SaveMessagesDialog.ts',
            'src/ui/content/reader/ReaderPanel.ts',
            'src/ui/content/overlay/OverlaySession.ts',
            'src/ui/content/overlay/OverlaySurfaceHost.ts',
        ]) {
            expect(read(relativePath), relativePath).not.toContain('setSurfaceCss(');
        }
        expect(read('src/ui/content/bookmarks/save/bookmarkSaveDialogCss.ts')).not.toContain('_theme');
        expect(read('src/ui/content/export/saveMessagesDialogCss.ts')).not.toContain('_theme');
    });

    it('keeps migrated controllers on AppearanceSnapshot as their only theme state', () => {
        for (const relativePath of [
            'src/ui/content/controllers/ChatGPTComposerEditingController.ts',
            'src/ui/content/controllers/MessageToolbarOrchestrator.ts',
            'src/ui/content/bookmarks/BookmarksPanelController.ts',
        ]) {
            const source = read(relativePath);
            expect(source, relativePath).not.toMatch(/private theme(?:Overrides)?:/);
            expect(source, relativePath).not.toContain('this.theme = snapshot.theme');
            expect(source, relativePath).not.toContain('this.themeOverrides =');
        }

        const bookmarksController = read('src/ui/content/bookmarks/BookmarksPanelController.ts');
        const bookmarksPanel = read('src/ui/content/bookmarks/BookmarksPanel.ts');
        expect(bookmarksController).toContain('getAppearance()');
        expect(bookmarksController).not.toContain('getThemeOverrides()');
        expect(bookmarksPanel).not.toContain('resolveThemeOverrides');
    });

    it('does not retain the empty Bookmarks overlay subclass beside the shared Overlay session', () => {
        expect(existsSync(resolve(repoRoot, 'src/ui/content/bookmarks/ui/BookmarksOverlaySession.ts'))).toBe(false);

        const panel = read('src/ui/content/bookmarks/BookmarksPanel.ts');
        expect(panel).toContain("from '../overlay/OverlaySession'");
        expect(panel).toContain('new OverlaySession');
        expect(panel).not.toContain('BookmarksOverlaySession');
    });

    it('does not retain the superseded conversation virtualization controller or policy', () => {
        expect(existsSync(resolve(repoRoot, 'src/ui/content/controllers/ConversationVirtualizationController.ts'))).toBe(false);
        expect(existsSync(resolve(repoRoot, 'src/core/conversationVirtualization/policy.ts'))).toBe(false);

        const runtime = read('src/runtimes/content/entry.ts');
        expect(runtime).not.toContain('ConversationVirtualizationController');
    });
});
