import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../../src/services/export/saveMessagesFacade', () => ({
    collectConversationTurnsAsync: vi.fn(async () => ({
        turns: [
            { user: 'u1', assistant: 'a1', index: 0 },
            { user: 'u2', assistant: 'a2', index: 1 },
        ],
        metadata: {
            url: 'https://chatgpt.com/c/1',
            exportedAt: new Date('2026-03-01T00:00:00.000Z').toISOString(),
            title: 'T',
            count: 2,
            platform: 'ChatGPT',
        },
    })),
    exportTurnsMarkdown: vi.fn(async () => ({ ok: true, noop: false })),
    exportTurnsPdf: vi.fn(async () => ({ ok: true, noop: false })),
    exportTurnsPng: vi.fn(async () => ({ ok: true, noop: false })),
}));

import { collectConversationTurnsAsync, exportTurnsMarkdown, exportTurnsPdf, exportTurnsPng } from '../../../../src/services/export/saveMessagesFacade';
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

    it('opens with all messages selected and can export markdown/pdf/png', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        expect(collectConversationTurnsAsync).toHaveBeenCalledTimes(1);

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
        expect(getGridButtons().every((b) => b.dataset.active === '1')).toBe(true);
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

    it('uses an image icon for PNG and shows progress while PNG export is running', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            expect(options.png).toEqual({ width: 800 });
            options.onProgress?.({ phase: 'rendering', completed: 1, total: 2, filename: 'message-001.png' });
            await new Promise<void>((resolve) => {
                resolveExport = resolve;
            });
            options.onProgress?.({ phase: 'done', completed: 2, total: 2 });
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

        expect(shadow.querySelector('[role="progressbar"]')).toBeTruthy();
        expect(shadow.textContent).toContain('1/2');
        expect(shadow.textContent).toContain('message-001.png');

        resolveExport();
        await flushUi();
    });

    it('uses the configured PNG export width from settings', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        vi.mocked(exportTurnsPng).mockImplementationOnce(async (_turns, _indices, _metadata, options: any) => {
            expect(options.png).toEqual({ width: 640 });
            return { ok: true, noop: false };
        });

        const dlg = new SaveMessagesDialog();
        dlg.setExportSettings({ pngWidthPreset: 'tablet', pngCustomWidth: 920 });
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
            options.onProgress?.({ phase: 'rendering', completed: 1, total: 2, filename: 'message-001.png' });
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

        expect(shadow.textContent).toContain('正在渲染 1/2');
        expect(shadow.textContent).toContain('message-001.png');

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
        const css = getSaveMessagesDialogCss('light');

        expect(css).not.toContain('background: color-mix(in srgb, var(--aimd-bg-secondary) 76%, transparent);');
        expect(css).toContain('.message-chip:hover');
        expect(css).toContain('var(--aimd-button-secondary-hover)');
        expect(css).toContain('.segmented button:hover');
    });

    it('keeps save-message chips at a uniform width regardless of label digits', async () => {
        const { getSaveMessagesDialogCss } = await import('@/ui/content/export/saveMessagesDialogCss');
        const css = getSaveMessagesDialogCss('light');

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
