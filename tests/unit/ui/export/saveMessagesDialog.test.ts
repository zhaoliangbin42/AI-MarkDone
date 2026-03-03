import { describe, expect, it, vi } from 'vitest';

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

describe('SaveMessagesDialog', () => {
    it('opens with all messages selected and can export markdown/pdf', async () => {
        const adapter = { getPlatformId: () => 'chatgpt' } as any;

        const dlg = new SaveMessagesDialog();
        dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        expect(collectConversationTurns).toHaveBeenCalledTimes(1);

        const shadow = host!.shadowRoot!;
        const getGridButtons = () => Array.from(shadow.querySelectorAll<HTMLButtonElement>('.msg-btn'));
        expect(getGridButtons()).toHaveLength(2);
        expect(getGridButtons().every((b) => b.dataset.selected === '1')).toBe(true);

        // Deselect all disables save.
        shadow.querySelector<HTMLButtonElement>('[data-action="deselect_all"]')!.click();
        const saveBtn = shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!;
        expect(saveBtn.disabled).toBe(true);

        // Select first only, export markdown.
        getGridButtons()[0].click();
        expect(saveBtn.disabled).toBe(false);
        saveBtn.click();
        await Promise.resolve();
        expect(exportTurnsMarkdown).toHaveBeenCalledTimes(1);

        // Reopen, switch to PDF and export.
        dlg.open(adapter, 'light');
        const host2 = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow2 = host2.shadowRoot!;
        const pdfBtn = shadow2.querySelector<HTMLElement>('[data-format="pdf"]')!;
        pdfBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        shadow2.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
        await Promise.resolve();
        expect(exportTurnsPdf).toHaveBeenCalledTimes(1);
    });
});
