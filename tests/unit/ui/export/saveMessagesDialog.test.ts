import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../../src/services/export/saveMessagesFacade', () => ({
    collectConversationTurns: vi.fn(() => ({
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
}));

import { collectConversationTurns, exportTurnsMarkdown, exportTurnsPdf } from '../../../../src/services/export/saveMessagesFacade';
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

    it('opens with all messages selected and can export markdown/pdf', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        expect(collectConversationTurns).toHaveBeenCalledTimes(1);

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
        dlg.open(adapter, 'light');
        const host2 = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow2 = host2.shadowRoot!;
        const pdfBtn = shadow2.querySelector<HTMLElement>('[data-action="set-format"][data-format="pdf"]')!;
        pdfBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        shadow2.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await Promise.resolve();
        expect(exportTurnsPdf).toHaveBeenCalledTimes(1);
    });

    it('updates visible copy when the locale changes while open', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        dlg.open(adapter, 'light');

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
        dlg.open(adapter, 'light');

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();

        dlg.close();
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();

        await setLocale('zh_CN');
        await flushUi();

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
    });

    it('uses stronger semantic hover rules for chips and segmented buttons', async () => {
        const { getSaveMessagesDialogCss } = await import('@/ui/content/export/saveMessagesDialogCss');
        const css = getSaveMessagesDialogCss('light');

        expect(css).not.toContain('background: color-mix(in srgb, var(--aimd-bg-secondary) 76%, transparent);');
        expect(css).toContain('.message-chip:hover');
        expect(css).toContain('var(--aimd-button-secondary-hover)');
        expect(css).toContain('.segmented button:hover');
    });
});
