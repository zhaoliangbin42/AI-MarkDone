import { describe, expect, it, vi } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

const baseSettings = {
    version: 3,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    chatgpt: { showConversationDirectory: true },
    behavior: {
        showSaveMessages: true,
        showWordCount: true,
        enableClickToCopy: true,
        saveContextOnly: true,
        _contextOnlyConfirmed: true,
    },
    reader: {
        renderCodeInReader: true,
        commentExport: {
            prompts: [
                { id: 'prompt-1', title: 'Prompt 1', content: 'Please review the following comments:' },
            ],
            template: [
                { type: 'text', value: 'Regarding\n' },
                { type: 'token', key: 'selected_source' },
                { type: 'text', value: '\nMy comment is:\n' },
                { type: 'token', key: 'user_comment' },
            ],
        },
    },
    bookmarks: { sortMode: 'time-desc' },
    language: 'auto',
} as any;

describe('SettingsTabView', () => {
    it('renders the ChatGPT directory toggle instead of the removed folding controls', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const directoryToggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-conversation-directory"]');

        expect(directoryToggle?.checked).toBe(true);
        expect(root.querySelector('#aimd-chatgpt-folding-mode')).toBeNull();
        expect(root.querySelector('[data-role="settings-fold-dock"]')).toBeNull();
        expect(root.querySelector('[data-role="settings-folding-count"]')).toBeNull();
    });

    it('routes the ChatGPT directory toggle through injected actions', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
            setPlatforms: vi.fn(async () => undefined),
            setChatGptSettings: vi.fn(async () => undefined),
            setBehaviorSettings: vi.fn(async () => undefined),
            setReaderSettings: vi.fn(async () => undefined),
            setLanguage: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const directoryToggle = root.querySelector<HTMLInputElement>('[data-role="settings-chatgpt-conversation-directory"]')!;

        directoryToggle.checked = false;
        directoryToggle.dispatchEvent(new Event('change', { bubbles: true }));

        expect(actions.setChatGptSettings).toHaveBeenCalledWith({ showConversationDirectory: false });
    });

    it('renders shipped platform icon wrappers and storage/export content', async () => {
        const modal = { confirm: vi.fn(async () => true) } as any;
        const onExportAllBookmarks = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { exportAllBookmarks: onExportAllBookmarks } });
        view.setState({
            settings: structuredClone(baseSettings),
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        });

        const root = view.getElement();
        const platformIcons = root.querySelectorAll('.settings-card:first-child .settings-label__icon');
        const storageFill = root.querySelector('.storage-fill');
        const exportButton = root.querySelector<HTMLButtonElement>('.export-backup-btn');

        expect(root.classList.contains('aimd-settings')).toBe(true);
        expect(platformIcons).toHaveLength(4);
        expect(storageFill?.getAttribute('style')).toContain('50%');
        expect(exportButton).toBeTruthy();

        exportButton?.click();
        expect(onExportAllBookmarks).toHaveBeenCalledTimes(1);
    });

    it('keeps group headings at least as prominent as child item titles in settings typography', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.card-title {');
        expect(css).toContain('font-size: var(--_bookmarks-section-title-size);');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('font-size: var(--_bookmarks-item-title-size);');
        expect(css).toContain('.settings-select-trigger {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-label p,');
        expect(css).toContain('font-size: var(--aimd-text-xs);');
    });

    it('locks settings scrolling to the vertical axis while keeping settings rows in a stable two-column layout', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.settings-panel-scroll,');
        expect(css).toContain('overflow-x: hidden;');
        expect(css).toContain('overflow-y: auto;');
        expect(css).toContain('.toggle-row,');
        expect(css).toContain('flex-wrap: nowrap;');
        expect(css).toContain('.settings-label {');
        expect(css).toContain('flex: 1 1 auto;');
    });
});
