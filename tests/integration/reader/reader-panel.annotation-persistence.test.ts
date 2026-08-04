import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReaderAnnotationListEntry } from '@/contracts/readerAnnotations';
import { DEFAULT_SETTINGS } from '@/core/settings/types';

const annotationClientMock = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    navigate: vi.fn(),
}));

vi.mock('@/drivers/shared/clients/readerAnnotationsClient', () => ({
    readerAnnotationsClient: annotationClientMock,
    subscribeReaderAnnotationChanges: () => () => undefined,
}));

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

    it('keeps newly created annotations in memory while new persistence is off', async () => {
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [] } });
        const panel = new ReaderPanel();
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

        expect(annotationClientMock.create).not.toHaveBeenCalled();
        const comments = panel.getCommentExportContext()?.comments ?? [];
        expect(comments).toEqual([expect.objectContaining({ comment: 'Runtime-only note' })]);
        expect(comments[0]?.revision).toBeUndefined();
        getSelectionSpy.mockRestore();
        hidePanel(panel);
    });
});
