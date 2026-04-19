import { describe, expect, it, vi } from 'vitest';
import { getBookmarksPanelCss } from '@/ui/content/bookmarks/ui/styles/bookmarksPanelCss';

import { ModalHost } from '@/ui/content/components/ModalHost';
import { SettingsTabView } from '@/ui/content/bookmarks/ui/tabs/SettingsTabView';

const baseSettings = {
    version: 3,
    platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
    chatgpt: { foldingMode: 'off', defaultExpandedCount: 8, showFoldDock: true },
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
    it('hides dependent ChatGPT folding controls while folding mode is off', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const foldingModeTrigger = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-mode');
        const foldingMode = root.querySelector<HTMLElement>('#aimd-chatgpt-folding-mode .settings-select-trigger__label');
        const showFoldDock = root.querySelector<HTMLInputElement>('[data-role="settings-fold-dock"]');
        const countContainer = root.querySelector<HTMLElement>('[data-role="settings-folding-count-container"]');

        expect(foldingModeTrigger).toBeTruthy();
        expect(foldingMode?.textContent).toBe('chatgptFoldingModeOff');
        expect(showFoldDock).toBeNull();
        expect(countContainer).toBeNull();
    });

    it('matches the shipped mock structure with custom select triggers, stepped count control, and DeepSeek casing', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();

        expect(root.querySelectorAll('.settings-select-trigger').length).toBeGreaterThanOrEqual(2);
        expect(root.querySelector('.settings-select')).toBeNull();
        expect(root.querySelector('.settings-number-field')).toBeNull();
        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="keep_last_n"]')?.click();
        expect(root.querySelector('.settings-number-field')).toBeTruthy();
        expect(root.querySelector('[data-action="settings-step-count"][data-direction="up"]')).toBeTruthy();
        expect(root.querySelector('[data-action="settings-step-count"][data-direction="down"]')).toBeTruthy();
        const platformLabels = Array.from(root.querySelectorAll<HTMLElement>('.settings-card:first-child .settings-label strong'));
        const deepseekLabel = platformLabels.find((node) => node.textContent?.includes('Deep'));
        const firstPlatformLabel = platformLabels[0];

        expect(deepseekLabel?.textContent).toContain('DeepSeek');
        expect(deepseekLabel?.textContent).not.toContain('Deepseek');
        expect(firstPlatformLabel?.querySelector('.settings-label__icon')).toBeTruthy();
    });

    it('closes an open settings select when its trigger is clicked again', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const trigger = root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]');
        const menu = root.querySelector<HTMLElement>('.settings-select-menu');

        trigger?.click();
        expect(menu?.dataset.open).toBe('1');

        trigger?.click();
        expect(menu?.dataset.open).toBe('0');
    });

    it('uses an upward chevron for increment and a downward chevron for decrement', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    chatgpt: { foldingMode: 'keep_last_n', defaultExpandedCount: 4, showFoldDock: true },
                },
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const stepUp = root.querySelector<HTMLElement>('[data-action="settings-step-count"][data-direction="up"]');
        const stepDown = root.querySelector<HTMLElement>('[data-action="settings-step-count"][data-direction="down"]');

        expect(stepUp?.querySelector('polyline')?.getAttribute('points')).toBe('18 15 12 9 6 15');
        expect(stepDown?.querySelector('polyline')?.getAttribute('points')).toBe('6 9 12 15 18 9');
    });

    it('renders shipped platform icon wrappers and storage/export content instead of the old bare text-only settings markup', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            exportAllBookmarks: vi.fn(async () => undefined),
        };
        const onExportAllBookmarks = vi.fn(async () => undefined);

        const view = new SettingsTabView({ modal, actions: { ...actions, exportAllBookmarks: onExportAllBookmarks } });
        view.setState({
            settings: {
                version: 3,
                platforms: { chatgpt: true, gemini: true, claude: true, deepseek: true },
                chatgpt: { foldingMode: 'keep_last_n', defaultExpandedCount: 5, showFoldDock: true },
                behavior: {
                    showSaveMessages: true,
                    showWordCount: true,
                    enableClickToCopy: true,
                    saveContextOnly: false,
                    _contextOnlyConfirmed: true,
                },
                reader: { renderCodeInReader: true },
                bookmarks: { sortMode: 'alpha-asc' },
                performance: undefined,
                language: 'auto',
            },
            storageUsage: { usedBytes: 512, quotaBytes: 1024, usedPercentage: 50, warningLevel: 'none' },
        });

        const root = view.getElement();
        const platformIcons = root.querySelectorAll('.settings-card:first-child .settings-label__icon');
        const storageFill = root.querySelector('.storage-fill');
        const exportButton = root.querySelector<HTMLButtonElement>('.export-backup-btn');

        expect(root.classList.contains('aimd-settings')).toBe(true);
        expect(platformIcons).toHaveLength(4);
        expect(storageFill).toBeTruthy();
        expect(storageFill?.getAttribute('style')).toContain('50%');
        expect(root.textContent).toContain('backupWarning');
        expect(exportButton).toBeTruthy();

        exportButton?.click();
        expect(onExportAllBookmarks).toHaveBeenCalledTimes(1);
    });

    it('keeps group headings at least as prominent as child item titles in settings typography', () => {
        const css = getBookmarksPanelCss();

        expect(css).toContain('.card-title {');
        expect(css).toContain('font-size: var(--_bookmarks-section-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-section-title-weight);');
        expect(css).toContain('.settings-label strong {');
        expect(css).toContain('--_bookmarks-item-title-size: var(--aimd-text-sm);');
        expect(css).toContain('font-size: var(--_bookmarks-item-title-size);');
        expect(css).toContain('font-weight: var(--_bookmarks-item-title-weight);');
        expect(css).toContain('.settings-select-trigger {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-number {');
        expect(css).toContain('font-size: var(--aimd-text-sm);');
        expect(css).toContain('.settings-label p,');
        expect(css).toContain('font-size: var(--aimd-text-xs);');
        expect(css).toContain('.secondary-btn--primary {');
        expect(css).toContain('background: var(--aimd-interactive-primary);');
        expect(css).toContain('color: var(--aimd-text-on-primary);');
        expect(css).toContain('background: var(--aimd-interactive-primary-hover);');
    });

    it('routes settings updates through injected actions instead of directly depending on the rpc client', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
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
        const platformToggle = root.querySelector<HTMLInputElement>('[data-role="settings-platform-chatgpt"]')!;
        platformToggle.checked = false;
        platformToggle.dispatchEvent(new Event('change', { bubbles: true }));

        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="keep_last_n"]')?.click();
        root.querySelector<HTMLInputElement>('[data-role="settings-folding-count"]')!.value = '12';
        root.querySelector<HTMLInputElement>('[data-role="settings-folding-count"]')!.dispatchEvent(new Event('input', { bubbles: true }));
        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="language"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="language"][data-value="zh_CN"]')?.click();

        expect(actions.setPlatforms).toHaveBeenCalledWith({ chatgpt: false });
        expect(actions.setChatGptSettings).toHaveBeenCalledWith({ foldingMode: 'keep_last_n' });
        expect(actions.setChatGptSettings).toHaveBeenCalledWith({ defaultExpandedCount: 12 });
        expect(actions.setLanguage).toHaveBeenCalledWith('zh_CN');
        expect(actions.setReaderSettings).not.toHaveBeenCalled();
    });

    it('shows fold dock controls once folding is enabled', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="folding-mode"]')?.click();
        root.querySelector<HTMLElement>('[data-action="settings-select-option"][data-menu="folding-mode"][data-value="all"]')?.click();

        const showFoldDock = root.querySelector<HTMLInputElement>('[data-role="settings-fold-dock"]');
        const helperText = root.textContent ?? '';

        expect(showFoldDock?.checked).toBe(true);
        expect(root.querySelector('#aimd-chatgpt-folding-power-mode')).toBeNull();
        expect(helperText).not.toContain('chatgptFoldingPowerModeHint');
    });

    it('does not render a reader markdown theme select once the feature is removed', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: { renderCodeInReader: true },
                },
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const trigger = root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="reader-markdown-theme"]');

        expect(trigger).toBeNull();
    });

    it('renders reader comment export settings entries as configure actions', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        const promptsButton = root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]');
        const templateButton = root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]');

        expect(promptsButton).toBeTruthy();
        expect(templateButton).toBeTruthy();
        expect(promptsButton?.classList.contains('icon-btn')).toBe(true);
        expect(templateButton?.classList.contains('icon-btn')).toBe(true);
        expect(promptsButton?.textContent?.trim()).toBe('');
        expect(templateButton?.textContent?.trim()).toBe('');
        expect(promptsButton?.querySelector('.aimd-icon')).toBeTruthy();
        expect(templateButton?.querySelector('.aimd-icon')).toBeTruthy();
        expect(promptsButton?.getAttribute('aria-label')).toContain('btnConfigure');
        expect(templateButton?.getAttribute('aria-label')).toContain('btnConfigure');
        expect(promptsButton?.classList.contains('settings-select-trigger')).toBe(false);
        expect(templateButton?.classList.contains('settings-select-trigger')).toBe(false);
        expect(promptsButton?.querySelector('.settings-select-trigger__caret')).toBeNull();
        expect(templateButton?.querySelector('.settings-select-trigger__caret')).toBeNull();
    });

    it('deletes a non-last prompt from the prompt library and persists the new ordered list', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: {
                        renderCodeInReader: true,
                        commentExport: {
                            prompts: [
                                { id: 'prompt-a', title: 'Prompt A', content: 'Please review.' },
                                { id: 'strict', title: 'Strict', content: 'Be very strict.' },
                            ],
                            template: structuredClone(baseSettings.reader.commentExport.template),
                        },
                    },
                },
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        root.querySelector<HTMLButtonElement>('.reader-prompt-settings__row [data-action="delete-prompt"]')?.click();
        await Promise.resolve();

        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                prompts: [expect.objectContaining({ id: 'strict' })],
            }),
        });
    });

    it('prevents deleting the last remaining prompt from the prompt library', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        const rows = root.querySelectorAll<HTMLElement>('.reader-prompt-settings__row');

        expect(rows).toHaveLength(1);
        expect(rows[0]?.querySelector('[data-action="delete-prompt"]')).toBeNull();
        expect(rows[0]?.querySelector('[data-action="open-prompt"]')).toBeTruthy();
        expect(root.querySelector('[data-action="add-prompt"] .aimd-icon')).toBeTruthy();
    });

    it('restores the starter prompt library and persists the default English prompts', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: {
                        renderCodeInReader: true,
                        commentExport: {
                            prompts: [
                                { id: 'custom-1', title: 'Custom prompt', content: 'Rewrite this.' },
                            ],
                            template: structuredClone(baseSettings.reader.commentExport.template),
                        },
                    },
                },
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="restore-default-prompts"]')?.click();
        await Promise.resolve();

        expect(modal.confirm).toHaveBeenCalled();
        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                prompts: [
                    expect.objectContaining({ id: 'prompt-1', title: 'Precise Revision' }),
                    expect.objectContaining({ id: 'prompt-2', title: 'Point-by-Point Revision' }),
                    expect.objectContaining({ id: 'prompt-3', title: 'Polished Final Draft' }),
                ],
            }),
        });
    });

    it('keeps the prompt settings popover open after confirming restore defaults through the real modal host', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const modal = new ModalHost(container);
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: {
                        renderCodeInReader: true,
                        commentExport: {
                            prompts: [
                                { id: 'custom-1', title: 'Custom prompt', content: 'Rewrite this.' },
                            ],
                            template: structuredClone(baseSettings.reader.commentExport.template),
                        },
                    },
                },
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        container.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="restore-default-prompts"]')?.click();

        expect(container.querySelector('.mock-modal-overlay')).toBeTruthy();
        container.querySelector<HTMLButtonElement>('[data-action="modal-confirm"]')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(root.querySelector('.reader-prompt-settings[data-view="list"]')).toBeTruthy();
        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                prompts: [
                    expect.objectContaining({ id: 'prompt-1', title: 'Precise Revision' }),
                    expect.objectContaining({ id: 'prompt-2', title: 'Point-by-Point Revision' }),
                    expect.objectContaining({ id: 'prompt-3', title: 'Polished Final Draft' }),
                ],
            }),
        });
    });

    it('reorders prompts via drag and drop and persists the new order', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: {
                        renderCodeInReader: true,
                        commentExport: {
                            prompts: [
                                { id: 'prompt-a', title: 'Prompt A', content: 'Please review.' },
                                { id: 'prompt-b', title: 'Prompt B', content: 'Be strict.' },
                            ],
                            template: structuredClone(baseSettings.reader.commentExport.template),
                        },
                    },
                },
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        const rows = root.querySelectorAll<HTMLElement>('.reader-prompt-settings__row');
        const dragged = rows[0]!;
        const target = rows[1]!;
        const handle = dragged.querySelector<HTMLElement>('[data-action="drag-prompt"]')!;
        expect(dragged.firstElementChild).toBe(handle);
        expect(handle.querySelectorAll('line')).toHaveLength(3);
        Object.assign(dragged, {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 56, right: 400, bottom: 56, x: 0, y: 0, toJSON: () => ({}) }),
        });
        Object.assign(target, {
            getBoundingClientRect: () => ({ left: 0, top: 64, width: 400, height: 56, right: 400, bottom: 120, x: 0, y: 64, toJSON: () => ({}) }),
        });

        const pointerDown = new MouseEvent('pointerdown', { bubbles: true, clientY: 28 });
        const pointerMove = new MouseEvent('pointermove', { bubbles: true, clientY: 110 });
        const pointerUp = new MouseEvent('pointerup', { bubbles: true, clientY: 110 });
        Object.defineProperty(pointerDown, 'pointerId', { value: 1 });
        Object.defineProperty(pointerMove, 'pointerId', { value: 1 });
        Object.defineProperty(pointerUp, 'pointerId', { value: 1 });
        handle.dispatchEvent(pointerDown);
        document.dispatchEvent(pointerMove);
        document.dispatchEvent(pointerUp);

        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                prompts: [
                    expect.objectContaining({ id: 'prompt-b' }),
                    expect.objectContaining({ id: 'prompt-a' }),
                ],
            }),
        });
    });

    it('uses the same dialog size for prompt and template settings popovers', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        const promptPopover = root.querySelector<HTMLElement>('.reader-prompt-settings');
        expect(promptPopover?.classList.contains('panel-window')).toBe(true);
        expect(promptPopover?.classList.contains('panel-window--dialog')).toBe(true);
        expect(promptPopover?.classList.contains('panel-window--reader-settings')).toBe(true);
        expect(promptPopover?.querySelector(':scope > .panel-header')).toBeTruthy();
        expect(promptPopover?.querySelector(':scope > .dialog-body')).toBeTruthy();
        expect(promptPopover?.querySelector(':scope > .panel-footer')).toBeTruthy();

        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]')?.click();
        const templatePopover = root.querySelector<HTMLElement>('.reader-settings-popover--template');
        expect(templatePopover?.classList.contains('panel-window')).toBe(true);
        expect(templatePopover?.classList.contains('panel-window--dialog')).toBe(true);
        expect(templatePopover?.classList.contains('panel-window--reader-settings')).toBe(true);
        expect(templatePopover?.querySelector(':scope > .panel-header')).toBeTruthy();
        expect(templatePopover?.querySelector(':scope > .dialog-body')).toBeTruthy();
        expect(templatePopover?.querySelector(':scope > .panel-footer')).toBeTruthy();
    });

    it('keeps the prompt settings popover open while navigating, typing, and saving inside it', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        expect(root.querySelector('.reader-prompt-settings')).toBeTruthy();

        root.querySelector<HTMLButtonElement>('[data-action="add-prompt"]')?.click();
        expect(root.querySelector('.reader-prompt-settings[data-view="edit"]')).toBeTruthy();

        const titleInput = root.querySelector<HTMLInputElement>('[data-role="prompt-title"]')!;
        titleInput.value = 'My prompt';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.click();
        expect(root.querySelector('.reader-prompt-settings[data-view="edit"]')).toBeTruthy();

        const contentInput = root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')!;
        contentInput.value = 'Use this prompt.';
        contentInput.dispatchEvent(new Event('input', { bubbles: true }));
        root.querySelector<HTMLButtonElement>('[data-action="back-to-prompts"]')?.click();
        expect(root.querySelector('.reader-prompt-settings[data-view="list"]')).toBeTruthy();

        root.querySelector<HTMLButtonElement>('[data-action="add-prompt"]')?.click();
        root.querySelector<HTMLInputElement>('[data-role="prompt-title"]')!.value = 'Saved prompt';
        root.querySelector<HTMLTextAreaElement>('[data-role="prompt-content"]')!.value = 'Saved content';
        root.querySelector<HTMLButtonElement>('[data-action="save-prompt"]')?.click();

        expect(root.querySelector('.reader-prompt-settings[data-view="list"]')).toBeTruthy();
        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                prompts: expect.arrayContaining([
                    expect.objectContaining({ title: 'Saved prompt', content: 'Saved content' }),
                ]),
            }),
        });
    });

    it('opens an existing prompt in the prompt settings edit view', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="open-prompt"]')?.click();

        expect(root.querySelector('.reader-prompt-settings[data-view="edit"]')).toBeTruthy();
        expect(root.querySelector<HTMLInputElement>('[data-role="prompt-title"]')?.value).toBe('Prompt 1');
    });

    it('closes only the active reader settings popover on Escape', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };
        const outerEscape = vi.fn();

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') outerEscape();
        });
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-prompts"]')?.click();
        const popover = root.querySelector<HTMLElement>('.reader-prompt-settings')!;

        popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(root.querySelector('.reader-prompt-settings')).toBeNull();
        expect(outerEscape).not.toHaveBeenCalled();
    });

    it('keeps template settings Escape scoped to the template popover', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };
        const outerEscape = vi.fn();

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') outerEscape();
        });
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]')?.click();
        const editor = root.querySelector<HTMLElement>('[data-role="commentTemplate"]')!;

        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(root.querySelector('.reader-settings-popover--template')).toBeNull();
        expect(outerEscape).not.toHaveBeenCalled();
    });

    it('inserts template placeholders through the placeholder menu instead of direct top-level token buttons', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]')?.click();

        expect(root.querySelector('[data-action="toggle-placeholder-menu"]')).toBeTruthy();
        expect(root.querySelector('[data-action="insert-selected-source"]')).toBeTruthy();
        expect(root.querySelector('[data-action="insert-user-comment"]')).toBeTruthy();

        root.querySelector<HTMLButtonElement>('[data-action="toggle-placeholder-menu"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="insert-user-comment"]')?.click();
        root.querySelector<HTMLButtonElement>('[data-action="save"]')?.click();

        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                template: expect.arrayContaining([
                    expect.objectContaining({ type: 'token', key: 'user_comment' }),
                ]),
            }),
        });
    });

    it('lets the settings tab consume Escape for open reader settings popovers and select menus', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();
        const root = view.getElement();
        document.body.appendChild(root);

        expect(view.consumeEscape()).toBe(false);

        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]')?.click();
        expect(root.querySelector('.reader-settings-popover--template')).toBeTruthy();
        expect(view.consumeEscape()).toBe(true);
        expect(root.querySelector('.reader-settings-popover--template')).toBeNull();

        root.querySelector<HTMLButtonElement>('[data-action="toggle-settings-menu"][data-menu="language"]')?.click();
        expect(root.querySelector('.settings-select-menu[data-open="1"]')).toBeTruthy();
        expect(view.consumeEscape()).toBe(true);
        expect(root.querySelector('.settings-select-menu[data-open="1"]')).toBeNull();
    });

    it('opens the larger comment template settings popover without closing on internal actions', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: structuredClone(baseSettings),
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]')?.click();

        expect(root.querySelector('.panel-window--reader-settings.reader-settings-popover--template')).toBeTruthy();
        expect(root.textContent).toContain('readerCommentTemplatePreviewLabel');
        expect(root.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('2.');
        const toggleMenu = root.querySelector<HTMLButtonElement>('[data-action="toggle-placeholder-menu"]');
        expect(toggleMenu).toBeTruthy();
        toggleMenu?.click();
        const insertSelected = root.querySelector<HTMLButtonElement>('[data-action="insert-selected-source"]');
        const insertComment = root.querySelector<HTMLButtonElement>('[data-action="insert-user-comment"]');
        expect(insertSelected?.textContent).toContain('readerCommentTemplateInsertSelectedSource');
        expect(insertComment?.textContent).toContain('readerCommentTemplateInsertUserComment');
        expect(insertSelected?.querySelector('.aimd-icon')).toBeTruthy();
        expect(insertComment?.querySelector('.aimd-icon')).toBeTruthy();
        insertSelected?.click();
        expect(root.querySelector('.panel-window--reader-settings.reader-settings-popover--template')).toBeTruthy();

        root.querySelector<HTMLButtonElement>('.panel-window--reader-settings.reader-settings-popover--template [data-action="save"]')?.click();
        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                template: expect.arrayContaining([
                    expect.objectContaining({ type: 'token', key: 'selected_source' }),
                ]),
            }),
        });
    });

    it('restores the default annotation template and keeps save as the persistence boundary', async () => {
        const modal = {
            confirm: vi.fn(async () => true),
        } as any;
        const actions = {
            loadState: vi.fn(async () => ({
                settings: {
                    ...structuredClone(baseSettings),
                    reader: {
                        renderCodeInReader: true,
                        commentExport: {
                            prompts: structuredClone(baseSettings.reader.commentExport.prompts),
                            template: [
                                { type: 'text', value: 'Custom template\n' },
                                { type: 'token', key: 'user_comment' },
                            ],
                        },
                    },
                },
                storageUsage: null,
            })),
            setReaderSettings: vi.fn(async () => undefined),
        };

        const view = new SettingsTabView({ modal, actions });
        await view.refresh();

        const root = view.getElement();
        document.body.appendChild(root);
        root.querySelector<HTMLButtonElement>('[data-role="settings-reader-template"]')?.click();

        root.querySelector<HTMLButtonElement>('[data-action="restore-default-template"]')?.click();
        expect(actions.setReaderSettings).not.toHaveBeenCalled();
        expect(root.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('Regarding the following text:');
        expect(root.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('<selected_text>');
        expect(root.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('My annotation:');
        expect(root.querySelector<HTMLElement>('[data-role="preview"]')?.textContent).toContain('<annotation>');

        root.querySelector<HTMLButtonElement>('.panel-window--reader-settings.reader-settings-popover--template [data-action="save"]')?.click();

        expect(actions.setReaderSettings).toHaveBeenCalledWith({
            commentExport: expect.objectContaining({
                template: [
                    { type: 'text', value: 'Regarding the following text:\n<selected_text>\n' },
                    { type: 'token', key: 'selected_source' },
                    { type: 'text', value: '\n</selected_text>\n\nMy annotation:\n<annotation>\n' },
                    { type: 'token', key: 'user_comment' },
                    { type: 'text', value: '\n</annotation>' },
                ],
            }),
        });
    });
});
