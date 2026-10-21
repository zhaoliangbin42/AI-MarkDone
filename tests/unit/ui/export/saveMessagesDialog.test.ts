import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../../../src/services/export/saveMessagesFacade', () => ({
    exportTurnsMarkdown: vi.fn(async () => ({ ok: true, noop: false })),
    exportTurnsMarkdownZip: vi.fn(async () => ({ ok: true, noop: false })),
    exportTurnsPdf: vi.fn(async (_turns, _indices, _metadata, options) => {
        options.onPrepared?.();
        return { ok: true, noop: false };
    }),
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
    isReaderContentSourceRevisionCurrent: vi.fn(() => true),
    readerItemsToChatTurns: vi.fn(async (items: any[]) =>
        Promise.all(items.map(async (item, index) => ({
            user: item.userPrompt,
            assistant: typeof item.content === 'function' ? await item.content() : item.content,
            ...(item.sourceContent !== undefined ? { assistantSource: typeof item.sourceContent === 'function' ? await item.sourceContent() : item.sourceContent } : {}),
            ...(item.richBlocks ? { richBlocks: item.richBlocks } : {}),
            ...(item.richImages ? { richImages: item.richImages } : {}),
            ...(item.meta?.assistantMessageId ? { messageId: item.meta.assistantMessageId } : {}),
            ...(item.meta?.url ? { documentUrl: item.meta.url } : {}),
            index,
        }))),
    ),
}));

import { exportTurnsMarkdown, exportTurnsMarkdownZip, exportTurnsPdf, exportTurnsPng } from '../../../../src/services/export/saveMessagesFacade';
import {
    collectFreshReaderContent,
    isReaderContentSourceRevisionCurrent,
    readerItemsToChatTurns,
} from '../../../../src/services/reader/readerContentSource';
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

function pointerClick(element: HTMLElement): void {
    element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, button: 0 }));
    element.click();
}

function chooseFormat(shadow: ShadowRoot, format: string): void {
    const control = shadow.querySelector<HTMLElement>('[data-role="export-format-control"]')!;
    const trigger = control.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')!;
    pointerClick(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    pointerClick(control.querySelector<HTMLElement>(`[data-format="${format}"]`)!);
}

function richItems() {
    return [{
        id: 'rich', userPrompt: 'Question', content: '![Counts](aimd-rich:rich-1-test)',
        richBlocks: [{ id: 'rich-1-test', kind: 'html' as const, label: 'Counts', visualDigest: 'test', fallbackMarkdown: '> Counts: 12', source: { kind: 'dom-capture' as const, surface: 'html' as const } }],
        meta: { assistantMessageId: 'assistant-rich', url: 'https://chatgpt.com/c/example', position: 1 },
    }, { id: 'plain', userPrompt: 'Other question', content: 'Plain reply', meta: { position: 2 } }];
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

    it('shows rich-content options only for a selected rich reply in PDF or PNG', async () => {
        await setLocale('en');
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({ items: richItems(), startIndex: 0, metadataSource: 'chatgpt-content-v1' });
        const dialog = new SaveMessagesDialog();
        await dialog.open({ getPlatformId: () => 'chatgpt' } as any, 'light');
        const shadow = document.getElementById('aimd-save-messages-dialog-host')!.shadowRoot!;
        expect(shadow.querySelector('[data-format="markdown-zip"]')).toBeTruthy();
        expect(shadow.querySelector('[data-index="0"]')?.classList.contains('message-chip')).toBe(true);
        expect(shadow.querySelector('[data-index="0"]')?.getAttribute('aria-pressed')).toBe('true');
        expect(shadow.querySelector('.panel-window--save')?.classList.contains('flat-workflow')).toBe(true);
        expect(shadow.querySelector('[data-role="export-format-control"] [aria-haspopup="listbox"]')).toBeTruthy();
        expect(shadow.querySelector('[data-role="rich-content-options"]')).toBeNull();
        chooseFormat(shadow, 'pdf');
        expect(shadow.querySelector('[data-visuals="include"]')?.getAttribute('aria-selected')).toBe('true');
        pointerClick(shadow.querySelector<HTMLElement>('[data-index="0"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-index="1"]')!);
        expect(shadow.querySelector('[data-role="rich-content-options"]')).toBeNull();
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="select-all-turns"]')!);
        chooseFormat(shadow, 'png');
        expect(shadow.querySelector('[data-role="rich-content-options"]')).toBeTruthy();
    });

    it('passes the PDF visual choice through the real pointer path and waits for resource preparation before closing', async () => {
        await setLocale('en');
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({ items: richItems(), startIndex: 0, metadataSource: 'chatgpt-content-v1' });
        let options: any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPdf).mockImplementationOnce(async (_turns, _indices, _metadata, next) => {
            options = next;
            next.onProgress?.({ phase: 'preparing', completed: 1, total: 2 });
            await new Promise<void>(resolve => { resolveExport = resolve; });
            return { ok: true, noop: false };
        });
        const dialog = new SaveMessagesDialog();
        await dialog.open({ getPlatformId: () => 'chatgpt' } as any, 'light');
        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        pointerClick(shadow.querySelector<HTMLElement>('[data-format="pdf"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-visuals="placeholder"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="save-turns"]')!);
        await flushUi();
        expect(options.visuals).toBe('placeholder');
        expect(options.signal.aborted).toBe(false);
        expect(document.getElementById(host.id)).toBe(host);
        expect(shadow.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
        options.onPrepared();
        expect(document.getElementById(host.id)).toBeNull();
        resolveExport();
        await flushUi();
    });

    it('exports an offline ZIP from the frozen rich snapshot and can cancel its preparation', async () => {
        await setLocale('en');
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({ items: richItems(), startIndex: 0, metadataSource: 'chatgpt-content-v1' });
        let options: any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsMarkdownZip).mockImplementationOnce(async (turns, indices, _metadata, next) => {
            expect(indices).toEqual([0]);
            expect(turns[0]).toMatchObject({ messageId: 'assistant-rich', documentUrl: 'https://chatgpt.com/c/example', richBlocks: richItems()[0].richBlocks });
            options = next;
            next.onProgress?.({ phase: 'preparing', completed: 0, total: 1 });
            await new Promise<void>(resolve => { resolveExport = resolve; });
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: 'Cancelled' } };
        });
        const dialog = new SaveMessagesDialog();
        await dialog.open({ getPlatformId: () => 'chatgpt' } as any, 'light');
        const shadow = document.getElementById('aimd-save-messages-dialog-host')!.shadowRoot!;
        pointerClick(shadow.querySelector<HTMLElement>('[data-format="markdown-zip"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="save-turns"]')!);
        await flushUi();
        expect(collectFreshReaderContent).toHaveBeenCalledTimes(1);
        expect(shadow.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="cancel-export"]')!);
        expect(options.signal.aborted).toBe(true);
        resolveExport();
        await flushUi();
        expect(shadow.textContent).toContain('Export cancelled');
        expect(dialog.isOpen()).toBe(true);
    });

    it('reports unavailable visuals as a concise result without requiring confirmation', async () => {
        await setLocale('zh_CN');
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({ items: richItems(), startIndex: 0, metadataSource: 'chatgpt-content-v1' });
        vi.mocked(exportTurnsMarkdownZip).mockResolvedValueOnce({ ok: true, noop: false, richContent: { included: 1, placeholders: 1 } });
        const dialog = new SaveMessagesDialog();
        await dialog.open({ getPlatformId: () => 'chatgpt' } as any, 'light');
        const shadow = document.getElementById('aimd-save-messages-dialog-host')!.shadowRoot!;
        expect(shadow.textContent).toContain('Markdown 离线包（ZIP）');
        pointerClick(shadow.querySelector<HTMLElement>('[data-format="markdown-zip"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="save-turns"]')!);
        await flushUi();
        expect(dialog.isOpen()).toBe(true);
        expect(shadow.querySelector('[data-role="export-result"]')?.textContent).toContain('1 个富内容块已使用文字占位');
        expect(shadow.querySelector('[data-action="save-turns"]')?.hasAttribute('disabled')).toBe(false);
    });

    it('keeps export selection and rich descriptions frozen while resources are being prepared', async () => {
        await setLocale('en');
        const items = richItems();
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({ items, startIndex: 0, metadataSource: 'chatgpt-content-v1' });
        let captured: any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsMarkdownZip).mockImplementationOnce(async (turns, indices) => {
            captured = { turns, indices };
            await new Promise<void>(resolve => { resolveExport = resolve; });
            return { ok: true, noop: false };
        });
        const dialog = new SaveMessagesDialog();
        await dialog.open({ getPlatformId: () => 'chatgpt' } as any, 'light');
        const shadow = document.getElementById('aimd-save-messages-dialog-host')!.shadowRoot!;
        pointerClick(shadow.querySelector<HTMLElement>('[data-format="markdown-zip"]')!);
        pointerClick(shadow.querySelector<HTMLElement>('[data-action="save-turns"]')!);
        await flushUi();
        items[0].richBlocks![0].label = 'Changed after opening';
        pointerClick(shadow.querySelector<HTMLElement>('[data-index="1"]')!);
        expect(captured.indices).toEqual([0]);
        expect(captured.turns[0].richBlocks[0].label).toBe('Counts');
        expect(Object.isFrozen(captured.turns[0])).toBe(true);
        expect(shadow.querySelector<HTMLButtonElement>('[data-format="pdf"]')!.disabled).toBe(true);
        resolveExport();
        await flushUi();
    });

    it('ignores an obsolete PDF preparation callback after the dialog is closed and reopened', async () => {
        await setLocale('en');
        let options: any;
        let resolveExport!: () => void;
        vi.mocked(exportTurnsPdf).mockImplementationOnce(async (_turns, _indices, _metadata, next) => {
            options = next;
            await new Promise<void>(resolve => { resolveExport = resolve; });
            return { ok: true, noop: false };
        });
        const dialog = new SaveMessagesDialog();
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        await dialog.open(adapter, 'light');
        const oldHost = document.getElementById('aimd-save-messages-dialog-host')!;
        pointerClick(oldHost.shadowRoot!.querySelector<HTMLElement>('[data-format="pdf"]')!);
        pointerClick(oldHost.shadowRoot!.querySelector<HTMLElement>('[data-action="save-turns"]')!);
        await flushUi();
        dialog.close();
        expect(options.signal.aborted).toBe(true);
        oldHost.shadowRoot!.querySelector('.panel-window--save')!.dispatchEvent(new Event('animationend', { bubbles: true }));
        await dialog.open(adapter, 'light');
        const newHost = document.getElementById('aimd-save-messages-dialog-host')!;
        options.onPrepared();
        resolveExport();
        await flushUi();
        expect(document.getElementById(newHost.id)).toBe(newHost);
        expect(newHost.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.disabled).toBe(false);
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
        expect(shadow.querySelector('.panel-window--save .panel-header__meta h2')?.textContent).toBe('Export messages');
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

    it('keeps an unavailable ChatGPT source mountable without enabling an empty export', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({
            items: [],
            startIndex: 0,
            metadataSource: 'chatgpt-snapshot',
            status: 'unavailable',
        });
        vi.mocked(isReaderContentSourceRevisionCurrent).mockReturnValueOnce(false);

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light');

        const host = document.getElementById('aimd-save-messages-dialog-host');
        expect(host).toBeTruthy();
        const saveButton = host!.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="save-turns"]');
        expect(saveButton?.disabled).toBe(true);
        saveButton?.click();
        await Promise.resolve();
        expect(exportTurnsMarkdown).not.toHaveBeenCalled();
    });

    it('opens an export from the currently recognized content snapshot', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const conversationContentSource = { read: vi.fn() } as any;
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({
            items: [{ id: 'r1', userPrompt: 'u1', content: 'a1', meta: { position: 1 } }],
            startIndex: 0,
            metadataSource: 'chatgpt-content-v1',
            status: 'ready',
            coverage: 'complete',
        });

        const dlg = new SaveMessagesDialog();
        await expect(dlg.open(adapter, 'light', { conversationContentSource })).resolves.toBe(true);
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();
    });

    it('keeps full-conversation export available from the maintained cache', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const conversationContentSource = { read: vi.fn() } as any;
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({
            items: [{ id: 'r1', userPrompt: 'u1', content: 'a1', meta: { position: 1 } }],
            startIndex: 0,
            metadataSource: 'chatgpt-content-v1',
            status: 'ready',
            coverage: 'complete',
        });

        const dlg = new SaveMessagesDialog();
        await expect(dlg.open(adapter, 'light', { conversationContentSource })).resolves.toBe(true);
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();
    });

    it('uses the published snapshot without rechecking its source quality at click time', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const conversationContentSource = { read: vi.fn() } as any;
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({
            items: [{ id: 'r1', userPrompt: 'u1', content: 'a1', meta: { position: 1 } }],
            startIndex: 0,
            metadataSource: 'chatgpt-content-v1',
            status: 'ready',
            coverage: 'complete',
            sourceQuality: 'mixed',
        });

        const dlg = new SaveMessagesDialog();
        await expect(dlg.open(adapter, 'light', { conversationContentSource })).resolves.toBe(true);
        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();
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

    it('inverts the selected export messages from the current selection', async () => {
        await setLocale('en');
        const dlg = new SaveMessagesDialog();
        await dlg.open({ getPlatformId: () => 'chatgpt' } as any, 'light');
        const host = document.getElementById('aimd-save-messages-dialog-host')!;
        const shadow = host.shadowRoot!;
        const chips = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.message-chip'));

        expect(chips.map(chip => chip.dataset.active)).toEqual(['1', '0']);
        shadow.querySelector<HTMLButtonElement>('[data-action="invert-turns"]')!.click();
        expect(Array.from(shadow.querySelectorAll<HTMLButtonElement>('.message-chip')).map(chip => chip.dataset.active)).toEqual(['0', '1']);
        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await Promise.resolve();
        expect(exportTurnsMarkdown).toHaveBeenLastCalledWith(expect.any(Array), [1], expect.any(Object), expect.any(Object));
    });

    it('opens from the fresh ReaderItem source for ChatGPT exports', async () => {
        await setLocale('en');
        const adapter = {
            getPlatformId: () => 'chatgpt',
            getMessageId: () => 'a1',
            extractUserPrompt: () => 'u1',
        } as any;
        const conversationContentSource: any = {
            read: vi.fn(() => ({ kind: 'unavailable', document: null, snapshot: null, reason: 'source-unavailable', retryable: true })),
            subscribe: vi.fn(() => vi.fn()),
            refresh: vi.fn(async () => ({ kind: 'unavailable', document: null, snapshot: null, reason: 'source-unavailable', retryable: true })),
            isCurrent: vi.fn(() => false),
        };

        const dlg = new SaveMessagesDialog();
        await dlg.open(adapter, 'light', { conversationContentSource });

        expect(collectFreshReaderContent).toHaveBeenCalledWith(adapter, null, {
            conversationContentSource,
        });
    });

    it('does not require a second source revision read after the snapshot is projected', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const conversationContentSource = {
            read: vi.fn(() => ({ kind: 'unavailable', document: null, snapshot: null, reason: 'source-unavailable', retryable: true })),
            subscribe: vi.fn(() => vi.fn()),
            refresh: vi.fn(async () => ({ kind: 'unavailable', document: null, snapshot: null, reason: 'source-unavailable', retryable: true })),
            isCurrent: vi.fn(() => false),
        } as any;
        vi.mocked(isReaderContentSourceRevisionCurrent).mockReturnValueOnce(false);

        const dlg = new SaveMessagesDialog();
        await expect(dlg.open(adapter, 'light', { conversationContentSource })).resolves.toBe(true);

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeTruthy();
    });

    it('does not replace the shared ChatGPT pool with the clicked message when the pool is empty', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        const conversationContentSource = { read: vi.fn() } as any;
        vi.mocked(collectFreshReaderContent).mockResolvedValueOnce({
            items: [],
            startIndex: 0,
            metadataSource: 'chatgpt-content-v1',
            status: 'target-unresolved',
        });

        const dlg = new SaveMessagesDialog();
        await expect(dlg.open(adapter, 'light', {
            conversationContentSource,
            startMessageElement: document.createElement('article'),
            currentReaderItem: { id: 'clicked-only', userPrompt: 'clicked', content: 'clicked answer' },
        })).resolves.toBe(false);

        expect(document.getElementById('aimd-save-messages-dialog-host')).toBeNull();
    });

    it('selects PNG through the inline format menu and shows progress while export is running', async () => {
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
        chooseFormat(shadow, 'png');
        expect(shadow.querySelector('[data-role="export-format-control"] .settings-select-trigger__label')?.textContent).toBe('PNG');
        expect(shadow.querySelector('[data-format="png"]')?.getAttribute('aria-selected')).toBe('true');

        shadow.querySelector<HTMLButtonElement>('[data-action="save-turns"]')!.click();
        await flushUi();

        const progressBars = shadow.querySelectorAll('[role="progressbar"]');
        expect(progressBars).toHaveLength(2);
        expect(progressBars[0].getAttribute('aria-label')).toBe('Image progress');
        expect(Number(progressBars[0].getAttribute('aria-valuenow'))).toBeGreaterThan(0);
        expect(progressBars[1].getAttribute('aria-label')).toBe('Overall progress');
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

        expect(shadow.textContent).toContain('正在处理第 2/2 段图片');
        expect(shadow.querySelectorAll('[role="progressbar"]')).toHaveLength(2);

        resolveExport();
        await flushUi();
    });

    it('closes the dialog when PDF preparation finishes so the modal shell cannot leak into print', async () => {
        await setLocale('en');
        const adapter = { getPlatformId: () => 'chatgpt' } as any;
        vi.mocked(exportTurnsPdf).mockImplementationOnce(async (_turns, _indices, _metadata, options) => {
            expect(document.getElementById('aimd-save-messages-dialog-host')).not.toBeNull();
            options.onPrepared?.();
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

        expect(shadow.querySelector('.panel-window--save .panel-header__meta h2')?.textContent).toBe('Export messages');
        expect(shadow.textContent).toContain('Select all');

        await setLocale('zh_CN');
        await flushUi();

        expect(shadow.querySelector('.panel-window--save .panel-header__meta h2')?.textContent).toBe('导出消息');
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

    it('layers the scoped flat workflow after the shared surface materials', async () => {
        const { getSaveMessagesDialogCss } = await import('@/ui/content/export/saveMessagesDialogCss');
        const { getSurfaceMaterialCss } = await import('@/ui/content/components/styles/surfaceMaterialCss');
        const { getFlatWorkflowCss } = await import('@/ui/content/components/styles/flatWorkflowCss');
        const css = getSaveMessagesDialogCss();

        expect(css).toContain(getSurfaceMaterialCss());
        expect(css.trimEnd().endsWith(getFlatWorkflowCss().trimEnd())).toBe(true);
        expect(css.indexOf(getSurfaceMaterialCss())).toBeLessThan(css.indexOf(getFlatWorkflowCss()));
        expect(css).not.toContain('.message-chip[data-active="1"]:hover');
        expect(css).not.toContain('.segmented button[data-active="1"]:hover');
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

    it('uses token-sized message chips that allow longer numeric labels', async () => {
        const { getSaveMessagesDialogCss } = await import('@/ui/content/export/saveMessagesDialogCss');
        const css = getSaveMessagesDialogCss();

        const chipCss = css.match(/\.message-chip \{([^}]+)\}/)?.[1] ?? '';
        expect(chipCss).toContain('min-width: var(--aimd-size-control-action-panel);');
        expect(chipCss).toContain('height: var(--aimd-size-control-action-panel);');
        expect(chipCss).toContain('padding-inline: var(--aimd-space-2);');
        expect(chipCss).toContain('font-variant-numeric: tabular-nums;');
        expect(chipCss).not.toMatch(/(?:^|;)\s*width:/);
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
