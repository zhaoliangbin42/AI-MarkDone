import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../../src/services/export/saveMessagesFacade', () => ({
    exportTurnsMarkdown: vi.fn(async () => ({ ok: true, noop: false })),
    exportTurnsPdf: vi.fn(async () => ({ ok: true, noop: false })),
    exportTurnsPng: vi.fn(async () => ({ ok: true, noop: false })),
}));

vi.mock('../../../../src/services/reader/readerContentSource', () => ({
    collectFreshReaderContent: vi.fn(async () => ({
        items: [
            { id: 'r1', userPrompt: 'u1', content: 'a1', meta: { position: 1 } },
            { id: 'r2', userPrompt: 'u2', content: async () => 'a2', meta: { position: 2 } },
        ],
        startIndex: 0,
        metadataSource: 'chatgpt-snapshot',
    })),
    readerItemsToChatTurns: vi.fn(async (items: any[]) =>
        Promise.all(items.map(async (item, index) => ({
            user: item.userPrompt,
            assistant: typeof item.content === 'function' ? await item.content() : item.content,
            index,
        }))),
    ),
}));

import { exportTurnsMarkdown, exportTurnsPdf, exportTurnsPng } from '../../../../src/services/export/saveMessagesFacade';
import { collectFreshReaderContent, readerItemsToChatTurns } from '../../../../src/services/reader/readerContentSource';
import { SaveMessagesDialog } from '../../../../src/ui/content/export/SaveMessagesDialog';
import { setLocale } from '../../../../src/ui/content/components/i18n';

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function flushUi(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('SaveMessagesDialog', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
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
    });

    afterEach(async () => {
        document.body.innerHTML = '';
        await setLocale('en');
        vi.unstubAllGlobals();
    });

    it('opens with only the current message selected and can export markdown/pdf/png', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        expect(collectFreshReaderContent).toHaveBeenCalledTimes(1);
        expect(readerItemsToChatTurns).toHaveBeenCalledTimes(1);

        const shadow = host!.shadowRoot!;
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/export/SaveMessagesDialog.ts'), 'utf8');
        const getGridButtons = () => Array.from(shadow.querySelectorAll<HTMLButtonElement>('.message-chip'));

        expect(shadow.querySelector('[data-role="overlay-backdrop-root"] .panel-stage__overlay')).toBeTruthy();
        expect(shadow.querySelector('[data-role="overlay-surface-root"] .panel-window.panel-window--dialog.panel-window--save')).toBeTruthy();
        expect(shadow.querySelector('.panel-window--save .panel-header__meta h2')?.textContent).toBe('Save Messages As');
        expect(shadow.querySelector('.panel-window--save .panel-kicker')).toBeNull();
        expect(shadow.querySelectorAll('.panel-window--save .panel-footer')).toHaveLength(1);
        expect(source).toContain('OverlaySession');
        expect(getGridButtons()).toHaveLength(2);
        expect(getGridButtons().map((b) => b.dataset.active)).toEqual(['1', '0']);
        expect(shadow.textContent).toContain('PNG');

        // Deselect all disables save.
        shadow.querySelector<HTMLButtonElement>('[data-action="deselect-all-turns"]')!.click();
        let saveBtn = shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!;
        expect(saveBtn.disabled).toBe(true);

        // Select first only, export markdown.
        getGridButtons()[0].click();
        saveBtn = host!.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!;
        expect(saveBtn.disabled).toBe(false);
        saveBtn.click();
        await Promise.resolve();
        expect(exportTurnsMarkdown).toHaveBeenCalledTimes(1);

        // Reopen, switch to PDF and export.
        await dlg.open(adapter, 'light');
        const host2 = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow2 = host2.shadowRoot!;
        const pdfBtn = shadow2.querySelector<HTMLElement>('[data-action="set-format"][data-format="pdf"]')!;
        pdfBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        shadow2.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await Promise.resolve();
        expect(exportTurnsPdf).toHaveBeenCalledTimes(1);

        // Reopen, switch to PNG and export.
        await dlg.open(adapter, 'light');
        const host3 = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow3 = host3.shadowRoot!;
        const pngBtn = shadow3.querySelector<HTMLElement>('[data-action="set-format"][data-format="png"]')!;
        pngBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        shadow3.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await Promise.resolve();
        expect(exportTurnsPng).toHaveBeenCalledTimes(1);
    });

    it('uses the Reader source startIndex as the default selected export item', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({
            items: [
                { id: 'r1', userPrompt: 'u1', content: 'a1', meta: { position: 1 } },
                { id: 'r2', userPrompt: 'u2', content: 'a2', meta: { position: 2 } },
                { id: 'r3', userPrompt: 'u3', content: 'a3', meta: { position: 3 } },
            ],
            startIndex: 1,
            metadataSource: 'chatgpt-snapshot',
        });

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        const chips = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.message-chip'));
        expect(chips.map((chip) => chip.dataset.active)).toEqual(['0', '1', '0']);

        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await Promise.resolve();

        expect(exportTurnsMarkdown).toHaveBeenCalledWith(
            expect.any(Array),
            [1],
            expect.any(Object),
            expect.any(Object),
        );
    });

    it('opens from the fresh ReaderItem source for ChatGPT exports', async () => {
        await setLocale('en');
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'a1',
            extractUserPrompt: () => 'u1',
        } as any;
        const chatGptConversationEngine: any = {
            getSnapshot: vi.fn(async () => null),
            forceRefreshCurrentConversation: vi.fn(),
        };

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light', { chatGptConversationEngine });

        expect(collectFreshReaderContent).toHaveBeenCalledWith(adapter, null, {
            chatGptConversationEngine,
        });
    });

    it('uses an image icon for PNG and shows progress while PNG export is running', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            expect(options.png).toEqual({ width: 800, pixelRatio: 1 });
            options.onProgress?.({
                phase: 'rendering',
                completed: 0,
                total: 1,
                render: { phase: 'rasterizing', completed: 1, total: 5 },
            });
            options.onProgress?.({
                phase: 'rendering',
                completed: 0,
                total: 1,
                render: { phase: 'preparing' },
            });
            await new Promise<void>((resolve) => {
                resolveExport = resolve;
            });
            options.onProgress?.({ phase: 'done', completed: 1, total: 1 });
            return { ok: true, noop: false };
        });

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        const pngBtn = shadow.querySelector<HTMLElement>('[data-action="set-format"][data-format="png"]')!;
        pngBtn.click();

        expect(pngBtn.innerHTML).toContain('circle cx="9" cy="9"');
        expect(pngBtn.innerHTML).toContain('rect x="3" y="3"');

        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();

        const progressBars = shadow.querySelectorAll('[role="progressbar"]');
        expect(progressBars).toHaveLength(2);
        expect(progressBars[0].getAttribute('aria-label')).toBe('Image rendering');
        expect(Number(progressBars[0].getAttribute('aria-valuenow'))).toBeGreaterThan(0);
        expect(progressBars[1].getAttribute('aria-label')).toBe('Total export');
        expect(shadow.textContent).toContain('2/5');
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="cancel-png-export"]')?.textContent).toBe('Cancel');

        resolveExport();
        await flushUi();
    });

    it('cancels a running PNG export when the dialog close button is clicked', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        let signal: AbortSignal | null = null;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            signal = options.signal;
            options.onProgress?.({
                phase: 'rendering',
                completed: 0,
                total: 2,
            });
            await new Promise<void>((resolve) => {
                resolveExport = resolve;
            });
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: 'copyPngCancelled' } };
        });

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-format"][data-format="png"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();

        shadow.querySelector<HTMLButtonElement>('[data-action="close-panel"]')!.click();
        expect(signal?.aborted).toBe(true);
        expect(shadow.querySelector<HTMLElement>('.panel-window--save')?.dataset.motionState).toBe('closing');

        resolveExport();
        await flushUi();
    });

    it('cancels a running PNG export from the explicit cancel button without closing first', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        let signal: AbortSignal | null = null;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            signal = options.signal;
            options.onProgress?.({
                phase: 'rendering',
                completed: 0,
                total: 2,
            });
            await new Promise<void>((resolve) => {
                resolveExport = resolve;
            });
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: 'pngExportCancelled' } };
        });

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-format"][data-format="png"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();

        shadow.querySelector<HTMLButtonElement>('[data-action="cancel-png-export"]')!.click();
        expect(signal?.aborted).toBe(true);
        expect(shadow.querySelector<HTMLElement>('.panel-window--save')?.dataset.motionState).not.toBe('closing');

        resolveExport();
        await flushUi();
    });

    it('uses the configured PNG export width from settings', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            expect(options.png).toEqual({ width: 640, pixelRatio: 2.5 });
            return { ok: true, noop: false };
        });

        const dlg = new SaveMessagesDialog();
        dlg.setExportSettings({ pngWidthPreset: 'tablet', pngCustomWidth: 920, pngPixelRatio: 2.5 });
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        expect(shadow.querySelector('[data-action="set-png-width"]')).toBeNull();
        shadow.querySelector<HTMLElement>('[data-action="set-format"][data-format="png"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();
        expect(exportTurnsPng).toHaveBeenCalledTimes(1);
    });

    it('localizes PNG progress copy for zh_CN while exporting', async () => {
        await setLocale('zh_CN');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            options.onProgress?.({
                phase: 'rendering',
                completed: 0,
                total: 1,
                render: { phase: 'encoding', completed: 1, total: 2 },
            });
            await new Promise<void>((resolve) => {
                resolveExport = resolve;
            });
            return { ok: true, noop: false };
        });

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-format"][data-format="png"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();

        expect(shadow.textContent).toContain('正在编码第 2/2 段');
        expect(shadow.querySelectorAll('[role="progressbar"]')).toHaveLength(2);

        resolveExport();
        await flushUi();
    });

    it('closes the dialog before starting PDF export so the modal shell cannot leak into print', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        vi.mocked(exportTurnsPdf).mockImplementationOnce(async () => {
            expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
            return { ok: true, noop: false };
        });

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        shadow.querySelector<HTMLElement>('[data-action="set-format"][data-format="pdf"]')!.click();
        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();

        expect(exportTurnsPdf).toHaveBeenCalledTimes(1);
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
    });

    it('updates visible copy when the locale changes while open', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        expect(shadow.querySelector('.panel-window--save .panel-header__meta h2')?.textContent).toBe('Save Messages As');
        expect(shadow.textContent).toContain('Select All');

        await setLocale('zh_CN');
        await flushUi();

        expect(shadow.querySelector('.panel-window--save .panel-header__meta h2')?.textContent).toBe('保存消息');
        expect(shadow.textContent).toContain('全选');
    });

    it('stops reacting to locale changes after close', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();

        dlg.close();
        const host = document.getElementById('aimd-save-messages-dialog-host');
        const panel = host?.shadowRoot?.querySelector<HTMLElement>('.panel-window--save');
        expect(host).toBeTruthy();
        expect(panel?.dataset.motionState).toBe('closing');
        panel?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();

        await setLocale('zh_CN');
        await flushUi();

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
    });

    it('keeps the dialog mounted in a closing state until the panel animation ends', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;
        const panel = shadow.querySelector<HTMLElement>('.panel-window--save')!;

        dlg.close();

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();
        expect(panel.dataset.motionState).toBe('closing');

        panel.dispatchEvent(new Event('animationend', { bubbles: true }));
        await flushUi();
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
    });

    it('reuses the current overlay session when reopened instead of leaving the previous shell in closing state', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const firstHost = document.getElementById('aimd-save-messages-dialog-host')!;
        const firstPanel = firstHost.shadowRoot!.querySelector<HTMLElement>('.panel-window--save')!;

        dlg.close();
        expect(firstPanel.dataset.motionState).toBe('closing');

        await dlg.open(adapter, 'light');

        const secondHost = document.getElementById('aimd-save-messages-dialog-host')!;
        const secondPanel = secondHost.shadowRoot!.querySelector<HTMLElement>('.panel-window--save')!;

        expect(secondHost).toBe(firstHost);
        expect(secondPanel.dataset.motionState).not.toBe('closing');
    });

    it('uses stronger semantic hover rules for chips and segmented buttons', async () => {
        const { getSaveMessagesDialogCss } = await import('@/ui/content/export/saveMessagesDialogCss');
        const css = getSaveMessagesDialogCss();

        expect(css).not.toContain('background: color-mix(in srgb, var(--aimd-bg-secondary) 76%, transparent);');
        expect(css).toContain('.message-chip:hover');
        expect(css).toContain('var(--aimd-button-secondary-hover)');
        expect(css).toContain('.segmented button:hover');
    });

    it('uses the modal Surface profile with one scrollable dialog body', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const dlg = new SaveMessagesDialog();

        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        const panel = shadow.querySelector<HTMLElement>('.panel-window--save')!;
        const body = shadow.querySelector<HTMLElement>('.dialog-body')!;

        expect(panel.style.getPropertyValue('--_surface-motion-open-duration')).toBe('280ms');
        expect(panel.getAttribute('aria-busy')).toBe('false');
        expect(body.classList.contains('workflow-dialog__body')).toBe(true);

        dlg.close();
        expect(panel.style.getPropertyValue('--_surface-motion-close-duration')).toBe('220ms');
        panel.dispatchEvent(new Event('animationend', { bubbles: true }));
    });

    it('keeps save-message chips at a uniform width regardless of label digits', async () => {
        const { getSaveMessagesDialogCss } = await import('@/ui/content/export/saveMessagesDialogCss');
        const css = getSaveMessagesDialogCss();

        expect(css).toContain('width: 42px;');
        expect(css).toContain('min-width: 42px;');
        expect(css).not.toContain('padding: 0 10px;');
    });

    it('does not close when text selection starts inside the dialog and releases on the backdrop', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        const panel = shadow.querySelector<HTMLElement>('.panel-window--save')!;
        const backdrop = shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"] .panel-stage__overlay')!;

        panel.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();
        expect(panel.dataset.motionState).not.toBe('closing');

        backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(panel.dataset.motionState).toBe('closing');
    });
});
