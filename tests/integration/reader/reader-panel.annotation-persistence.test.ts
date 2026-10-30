import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReaderAnnotationListEntry } from '@/contracts/readerAnnotations';
import { DEFAULT_SETTINGS } from '@/core/settings/types';

const annotationClientMock = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    navigate: vi.fn(),
    listeners: new Set<() => void>(),
}));

vi.mock('@/drivers/shared/clients/readerAnnotationsClient', () => ({
    readerAnnotationsClient: annotationClientMock,
    subscribeReaderAnnotationChanges: (_document: unknown, listener: () => void) => {
        annotationClientMock.listeners.add(listener);
        return () => annotationClientMock.listeners.delete(listener);
    },
}));

import { PageAnnotationStore } from '@/services/reader/pageAnnotationStore';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

function createSelection(range: Range): Selection {
    return {
        rangeCount: 1,
        getRangeAt: () => range,
        getComposedRanges: () => [{
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
        }],
        toString: () => range.toString(),
    } as unknown as Selection;
}

function installLayoutMocks(range: Range, markdownRoot: HTMLElement, unitElements: HTMLElement[] = []): void {
    Object.assign(range, {
        getClientRects: () => ([
            { left: 10, top: 10, width: 120, height: 18, right: 130, bottom: 28, x: 10, y: 10, toJSON: () => ({}) },
        ]),
    });
    Object.assign(markdownRoot, {
        getBoundingClientRect: () => ({
            left: 0, top: 0, width: 840, height: 320, right: 840, bottom: 320, x: 0, y: 0, toJSON: () => ({}),
        }),
    });
    unitElements.forEach((element, index) => {
        Object.assign(element, {
            getBoundingClientRect: () => ({
                left: 64 + (index * 36),
                top: 10,
                width: 34,
                height: 18,
                right: 98 + (index * 36),
                bottom: 28,
                x: 64 + (index * 36),
                y: 10,
                toJSON: () => ({}),
            }),
        });
    });
}

function hidePanel(panel: ReaderPanel): void {
    panel.hide();
    document.querySelectorAll<HTMLElement>('#aimd-reader-panel-host').forEach((host) => {
        host.shadowRoot?.querySelector<HTMLElement>('.panel-window')
            ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    });
}

function annotationEntry(): ReaderAnnotationListEntry {
    return {
        document: {
            platform: 'chatgpt',
            conversationId: 'conversation-1',
            title: 'Persistent conversation',
            lastKnownUrl: 'https://chatgpt.com/c/conversation-1',
        },
        annotation: {
            id: 'annotation-1',
            itemId: 'chatgpt-assistant-1',
            target: { assistantMessageId: 'assistant-1', position: 0 },
            quoteText: 'Persisted quote',
            sourceMarkdown: 'Persisted quote',
            comment: 'Persisted note',
            selectors: {
                textQuote: { exact: 'Persisted quote', prefix: '', suffix: '' },
                textPosition: { start: 0, end: 15 },
                domRange: null,
                atomicRefs: [],
            },
            createdAt: 100,
            updatedAt: 200,
            revision: 1,
            lastKnownAnchorState: 'unanchored',
        },
    };
}

function otherConversationEntry(): ReaderAnnotationListEntry {
    return {
        ...annotationEntry(),
        document: {
            platform: 'chatgpt',
            conversationId: 'conversation-2',
            title: 'Other persistent conversation',
            lastKnownUrl: 'https://chatgpt.com/c/conversation-2',
        },
        annotation: {
            ...annotationEntry().annotation,
            id: 'annotation-2',
            itemId: 'chatgpt-assistant-2',
            target: { assistantMessageId: 'assistant-2', position: 1 },
            comment: 'Other persisted note',
        },
    };
}

describe('ReaderPanel persistent ChatGPT annotations', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        annotationClientMock.listeners.clear();
        annotationClientMock.list.mockReset();
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [annotationEntry()] } });
        annotationClientMock.remove.mockReset();
        annotationClientMock.remove.mockResolvedValue({ ok: true, data: {} });
        annotationClientMock.update.mockReset();
        annotationClientMock.update.mockImplementation(async (_document, annotation) => ({
            ok: true,
            data: { annotation: { ...annotation, revision: annotation.revision + 1 } },
        }));
        annotationClientMock.create.mockReset();
    });

    it('keeps re-anchoring local instead of rewriting shared annotation revisions during rendering', async () => {
        const entry = annotationEntry();
        entry.annotation.lastKnownAnchorState = 'anchored';
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [entry] } });
        const panel = new ReaderPanel();
        await panel.show([{ id: 'chatgpt-assistant-1', userPrompt: 'Question', content: 'Different rendered text', meta: { assistantMessageId: 'assistant-1' } }], 0, 'light', { annotationDocument: entry.document });
        expect(annotationClientMock.update).not.toHaveBeenCalled();
        expect(panel.getCommentExportContext()?.comments[0]?.lastKnownAnchorState).toBe('unanchored');
        hidePanel(panel);
    });

    it('keeps page and Reader annotations in sync through storage notifications', async () => {
        let entries = [annotationEntry()];
        annotationClientMock.list.mockImplementation(async () => ({ ok: true, data: { entries: [...entries] } }));
        const store = new PageAnnotationStore();
        store.setPersistEnabled(true);
        await store.bindDocument(annotationEntry().document);
        const panel = new ReaderPanel();
        panel.setReaderSettings({ ...DEFAULT_SETTINGS.reader, persistAnnotations: true });
        await panel.show([{ id: 'chatgpt-assistant-1', userPrompt: 'Question', content: 'Persisted quote', meta: { assistantMessageId: 'assistant-1' } }], 0, 'light', { annotationDocument: annotationEntry().document });
        try {
            annotationClientMock.update.mockImplementation(async (_document, annotation) => {
                const saved = { ...annotation, revision: 2 };
                entries = [{ ...annotationEntry(), annotation: saved }];
                for (const listener of annotationClientMock.listeners) listener();
                return { ok: true, data: { annotation: saved } };
            });
            const record = store.listForConversation()[0]!;
            await store.update({ ...record, comment: 'Edited on page' }, record.target!);
            await vi.waitFor(() => expect(panel.getCommentExportContext()?.comments[0]?.comment).toBe('Edited on page'));
            annotationClientMock.remove.mockImplementation(async () => {
                entries = [];
                for (const listener of annotationClientMock.listeners) listener();
                return { ok: true, data: { deleted: true } };
            });
            const shadow = document.querySelector('#aimd-reader-panel-host')!.shadowRoot!;
            const managerButton = shadow.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')!;
            managerButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            managerButton.click();
            shadow.querySelector<HTMLButtonElement>('.reader-annotation-manager__row [data-action="delete"]')!.click();
            await Promise.resolve();
            shadow.querySelector<HTMLButtonElement>('.mock-modal__button--danger')!.click();
            await vi.waitFor(() => expect(store.listForConversation()).toHaveLength(0));
        } finally { hidePanel(panel); store.dispose(); }
    });

    it('does not overwrite newer annotations with a late initial read', async () => {
        let finish!: (value: any) => void;
        annotationClientMock.list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const panel = new ReaderPanel();
        const showing = panel.show([{ id: 'chatgpt-assistant-1', userPrompt: 'Question', content: 'Persisted quote', meta: { assistantMessageId: 'assistant-1' } }], 0, 'light', { annotationDocument: annotationEntry().document });
        expect(annotationClientMock.listeners.size).toBe(1);
        for (const listener of annotationClientMock.listeners) listener();
        await vi.waitFor(() => expect(annotationClientMock.list).toHaveBeenCalledTimes(2));
        await Promise.resolve();
        finish({ ok: true, data: { entries: [] } });
        await showing;
        expect(panel.getCommentExportContext()?.comments).toHaveLength(1);
        hidePanel(panel);
    });

    it('hydrates the same conversation bundle for a fresh Reader instance', async () => {
        const documentDescriptor = annotationEntry().document;
        const first = new ReaderPanel();
        first.setReaderSettings({ ...DEFAULT_SETTINGS.reader, persistAnnotations: true });
        await first.show([
            {
                id: 'chatgpt-assistant-1',
                userPrompt: 'Question',
                content: 'Persisted quote',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-1', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: documentDescriptor });
        expect(first.getCommentExportContext()?.comments).toEqual([expect.objectContaining({ comment: 'Persisted note', revision: 1, lastKnownAnchorState: 'unanchored' })]);

        hidePanel(first);
        const second = new ReaderPanel();
        second.setReaderSettings({ ...DEFAULT_SETTINGS.reader, persistAnnotations: true });
        await second.show([
            {
                id: 'chatgpt-assistant-1',
                userPrompt: 'Question',
                content: 'Persisted quote',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-1', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: documentDescriptor });
        expect(second.getCommentExportContext()?.comments[0]?.sourceMarkdown).toBe('Persisted quote');
        expect(annotationClientMock.list).toHaveBeenCalledWith(documentDescriptor);
        hidePanel(second);
    });

    it('opens the production annotation manager from the header with no current annotations', async () => {
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [] } });
        const panel = new ReaderPanel();
        const documentDescriptor = annotationEntry().document;
        await panel.show([
            {
                id: 'chatgpt-assistant-empty',
                userPrompt: 'Question',
                content: 'No annotation yet',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-empty', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: documentDescriptor });

        const shadow = document.querySelector('#aimd-reader-panel-host')?.shadowRoot;
        const trigger = shadow?.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]');
        expect(trigger?.disabled).toBe(false);
        trigger?.click();
        await Promise.resolve();
        expect(shadow?.querySelector('.mock-modal--reader-annotation-manager')).toBeTruthy();
        hidePanel(panel);
    });

    it('keeps previously persisted annotations visible while new persistence is off', async () => {
        const panel = new ReaderPanel();
        await panel.show([
            {
                id: 'chatgpt-assistant-1',
                userPrompt: 'Question',
                content: 'Persisted quote',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-1', position: 0 },
            },
        ], 0, 'light', {
            profile: 'conversation-reader',
            annotationDocument: annotationEntry().document,
        });

        expect(annotationClientMock.list).toHaveBeenCalledWith(annotationEntry().document);
        expect(panel.getCommentExportContext()?.comments).toEqual([
            expect.objectContaining({ id: 'annotation-1', comment: 'Persisted note', revision: 1 }),
        ]);
        hidePanel(panel);
    });

    it('keeps the global persisted collection visible while new persistence is off', async () => {
        const panel = new ReaderPanel();
        const documentDescriptor = annotationEntry().document;
        await panel.show([
            {
                id: 'chatgpt-assistant-1',
                userPrompt: 'Question',
                content: 'Persisted quote',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-1', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: documentDescriptor });

        annotationClientMock.list.mockClear();
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [annotationEntry(), otherConversationEntry()] } });
        const shadow = document.querySelector('#aimd-reader-panel-host')?.shadowRoot;
        shadow?.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')?.click();
        shadow?.querySelector<HTMLButtonElement>('[data-view="all"]')?.click();

        await vi.waitFor(() => {
            expect(annotationClientMock.list).toHaveBeenCalledWith();
            expect(shadow?.textContent).toContain('Other persisted note');
        });
        hidePanel(panel);
    });

    it('keeps existing persisted annotations durably deletable while new persistence is off', async () => {
        const panel = new ReaderPanel();
        const documentDescriptor = annotationEntry().document;
        await panel.show([
            {
                id: 'chatgpt-assistant-1',
                userPrompt: 'Question',
                content: 'Persisted quote',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-1', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: documentDescriptor });

        const shadow = document.querySelector('#aimd-reader-panel-host')?.shadowRoot;
        shadow?.querySelector<HTMLButtonElement>('[data-action="reader-comment-list"]')?.click();
        shadow?.querySelector<HTMLButtonElement>('.reader-annotation-manager__row [data-action="delete"]')?.click();
        await Promise.resolve();
        shadow?.querySelector<HTMLButtonElement>('.mock-modal__button--danger')?.click();
        await vi.waitFor(() => {
            expect(annotationClientMock.remove).toHaveBeenCalledWith(documentDescriptor, 'annotation-1', 1);
        });
        hidePanel(panel);
    });

    it('keeps existing persisted annotations durably editable while new persistence is off', async () => {
        const panel = new ReaderPanel();
        const documentDescriptor = annotationEntry().document;
        await panel.show([
            {
                id: 'chatgpt-assistant-1',
                userPrompt: 'Question',
                content: 'Persisted quote',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-1', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: documentDescriptor });

        const shadow = document.querySelector('#aimd-reader-panel-host')?.shadowRoot;
        expect(await panel.focusAnnotation('annotation-1', 'assistant-1')).toBe(true);
        const input = shadow?.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input');
        expect(input?.value).toBe('Persisted note');
        if (input) {
            input.value = 'Updated persisted note';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        shadow?.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')?.click();

        await vi.waitFor(() => {
            expect(annotationClientMock.update).toHaveBeenCalledWith(
                documentDescriptor,
                expect.objectContaining({ id: 'annotation-1', comment: 'Updated persisted note' }),
                1,
            );
        });
        hidePanel(panel);
    });

    it('automatically persists new annotations through the selection and Save flow', async () => {
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [] } });
        annotationClientMock.create.mockImplementation(async (_document, annotation) => ({ ok: true, data: { annotation: { ...annotation, revision: 1 } } }));
        const panel = new ReaderPanel();
        panel.setReaderSettings({ ...DEFAULT_SETTINGS.reader, persistAnnotations: false });
        await panel.show([
            {
                id: 'chatgpt-assistant-new',
                userPrompt: 'Question',
                content: 'Before `code` and $x+y$ after',
                meta: { platformId: 'chatgpt', assistantMessageId: 'assistant-new', position: 0 },
            },
        ], 0, 'light', { profile: 'conversation-reader', annotationDocument: annotationEntry().document });

        const shadow = document.querySelector('#aimd-reader-panel-host')?.shadowRoot;
        const markdownRoot = shadow?.querySelector<HTMLElement>('.reader-markdown');
        const paragraph = markdownRoot?.querySelector('p');
        expect(markdownRoot).toBeTruthy();
        expect(paragraph?.firstChild).toBeTruthy();
        const range = document.createRange();
        range.setStart(paragraph!.firstChild!, 0);
        range.setEnd(paragraph!.lastChild!, paragraph!.lastChild!.textContent?.length ?? 0);
        installLayoutMocks(
            range,
            markdownRoot!,
            Array.from(markdownRoot!.querySelectorAll<HTMLElement>('[data-aimd-unit-id]')),
        );
        const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue(createSelection(range));
        document.dispatchEvent(new Event('selectionchange'));
        document.dispatchEvent(new Event('pointerup'));
        await Promise.resolve();

        const addButton = shadow?.querySelector<HTMLButtonElement>('[data-action="reader-comment-add"]');
        expect(addButton).toBeTruthy();
        addButton?.click();
        await vi.waitFor(() => {
            expect(shadow?.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input')).toBeTruthy();
        });
        const input = shadow?.querySelector<HTMLTextAreaElement>('.reader-comment-popover__input');
        if (input) {
            input.value = 'Runtime-only note';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        shadow?.querySelector<HTMLButtonElement>('.reader-comment-popover [data-action="save"]')?.click();
        await Promise.resolve();

        await vi.waitFor(() => expect(annotationClientMock.create).toHaveBeenCalledTimes(1));
        const comments = panel.getCommentExportContext()?.comments ?? [];
        expect(comments).toEqual([expect.objectContaining({ comment: 'Runtime-only note' })]);
        expect(comments[0]?.revision).toBe(1);
        getSelectionSpy.mockRestore();
        hidePanel(panel);
    });
});
