import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import type { ConversationContentSourceV1 } from '@/contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '@/contracts/conversationMaterialization';
import { DOMContentSurfaceAdapter, type ContentSurfaceAdapter } from '@/drivers/content/adapters/ContentSurfaceAdapter';
import { ChatGPTPageAnnotationController } from '@/ui/content/controllers/ChatGPTPageAnnotationController';
import { toReaderAnnotationRecord } from '@/services/reader/commentSession';
import { createPageCommentRecord, resolveReaderCommentAnchor } from '@/services/reader/commentAnchoring';
import { createHighlightRecord } from '@/ui/content/highlights/HighlightSession';
import { RuntimeClientRequestError } from '@/drivers/shared/clients/clientResult';
import * as clipboard from '@/drivers/content/clipboard/clipboard';
import { setCanonicalMarkdownCopyFormulaFormat } from '@/services/copy/canonicalMarkdownCopy';

const annotationClientMock = vi.hoisted(() => ({
    list: vi.fn(async () => ({ ok: true, data: { entries: [] } })),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listeners: new Set<() => void>(),
}));
const highlightClientMock = vi.hoisted(() => ({list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), listeners: new Set<() => void>()}));
vi.mock('@/drivers/shared/clients/highlightsClient', () => ({highlightsClient: {
    list: highlightClientMock.list, create: highlightClientMock.create, update: highlightClientMock.update, remove: highlightClientMock.remove,
    subscribe: (listener: () => void) => {highlightClientMock.listeners.add(listener); return () => highlightClientMock.listeners.delete(listener);},
}}));

vi.mock('@/drivers/shared/clients/readerAnnotationsClient', () => ({
    readerAnnotationsClient: annotationClientMock,
    subscribeReaderAnnotationChanges: (_document: unknown, listener: () => void) => { annotationClientMock.listeners.add(listener); return () => annotationClientMock.listeners.delete(listener); },
}));

function mountMessage(content: string, id = 'assistant-1'): HTMLElement {
    const message = document.createElement('div');
    message.setAttribute('data-message-author-role', 'assistant');
    message.setAttribute('data-message-id', id);
    message.innerHTML = `<div class="markdown prose">${content}</div>`;
    document.body.appendChild(message);
    return message;
}

function selectRange(range: Range): void {
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

async function flushSelectionFrame(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function dispatchPointerUp(x: number, y: number): void {
    // jsdom has no PointerEvent constructor; MouseEvent carries the fields the
    // controller reads (button/clientX/clientY/composedPath).
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: x, clientY: y }));
}

function dispatchPointerDown(x: number, y: number): void {
    document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }));
}

function dispatchPointerCancel(x: number, y: number): void {
    document.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true, button: 0, clientX: x, clientY: y }));
}

function dispatchWindowBlur(): void {
    window.dispatchEvent(new Event('blur'));
}

function selectionToolbarHost(): HTMLElement | null {
    return document.querySelector<HTMLElement>('#aimd-chatgpt-page-annotation-overlay')
        ?.shadowRoot?.querySelector<HTMLElement>('.reader-comment-action') ?? null;
}

function selectionToolbarShadow(): ShadowRoot {
    const overlay = document.querySelector<HTMLElement>('#aimd-chatgpt-page-annotation-overlay');
    if (!overlay?.shadowRoot) throw new Error('Expected the page annotation overlay to be mounted.');
    return overlay.shadowRoot;
}

function selectionToolbarButton(action: string): HTMLButtonElement | null {
    return selectionToolbarHost()?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`) ?? null;
}

function mockGeometry(root: HTMLElement, codeElement: HTMLElement, range: Range): void {
    Object.assign(root, {
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
    });
    Object.assign(codeElement, {
        getBoundingClientRect: () => ({ left: 40, top: 50, width: 90, height: 18, right: 130, bottom: 68, x: 40, y: 50, toJSON: () => ({}) }),
    });
    Object.assign(range, {
        getClientRects: () => ([{ left: 40, top: 50, width: 90, height: 18, right: 130, bottom: 68, x: 40, y: 50, toJSON: () => ({}) }]),
    });
}

function createMaterialization(message: HTMLElement): ConversationMaterializationPortV1 {
    const target = {
        documentKey: 'chatgpt:conversation:test',
        turnId: 'turn-1',
        userMessageId: 'user-1',
        assistantMessageId: message.dataset.messageId ?? 'assistant-1',
    } as const;
    const snapshot = {
        materializationToken: 'materialization-1',
        contentToken: 'content-token-1',
        entries: [{ target, anchorElement: message, messageElement: message }],
    } as const;
    return {
        read: () => snapshot,
        subscribe: () => () => undefined,
        resolveElement: () => target,
        locate: async () => 'located',
    };
}

function createSignallingMaterialization(message: HTMLElement): ConversationMaterializationPortV1 & {
    emit(token: string): void;
} {
    const target = {
        documentKey: 'chatgpt:conversation:test',
        turnId: 'turn-1',
        userMessageId: 'user-1',
        assistantMessageId: message.dataset.messageId ?? 'assistant-1',
    } as const;
    const listeners = new Set<Parameters<ConversationMaterializationPortV1['subscribe']>[0]>();
    let token = 'materialization-1';
    const read = () => ({
        materializationToken: token,
        contentToken: 'content-token-1',
        entries: [{ target, anchorElement: message, messageElement: message }],
    } as const);
    return {
        read,
        subscribe: (listener) => {
            listeners.add(listener);
            listener(read());
            return () => listeners.delete(listener);
        },
        resolveElement: () => target,
        locate: async () => 'located',
        emit: (nextToken) => {
            token = nextToken;
            listeners.forEach((listener) => listener(read()));
        },
    };
}

function createContentSource(markdown = 'before **inline code** after'): ConversationContentSourceV1 {
    const document = {
        key: 'chatgpt:conversation:test',
        platformId: 'chatgpt',
        conversationId: 'test',
    } as const;
    const snapshot = {
        schemaVersion: 1 as const,
        document,
        contentToken: 'content-token-1',
        coverage: 'complete' as const,
        turns: [{
            key: 'turn-1:assistant-1',
            ordinal: 1,
            identity: { turnId: 'turn-1', userMessageId: 'user-1', assistantMessageId: 'assistant-1' },
            userText: 'Question',
            assistantMarkdown: markdown,
        }],
    };
    const state = { kind: 'ready' as const, document, snapshot };
    return {
        read: () => state,
        subscribe: () => () => undefined,
        refresh: async () => state,
        isCurrent: (token) => token === snapshot.contentToken,
    };
}

function createEvidenceSurfaceAdapter(message: HTMLElement): ContentSurfaceAdapter {
    const domAdapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), null);
    const locateSelection = (selection: Selection | null) => domAdapter.locateSelection(selection);
    return {
        locateSelection,
        materializeSelection: (location) => ({
            ...location,
            evidence: {
                target: {
                    documentKey: 'chatgpt:conversation:test',
                    turnId: 'turn-1',
                    userMessageId: 'user-1',
                    assistantMessageId: message.dataset.messageId ?? 'assistant-1',
                },
                contentToken: 'content-token-1',
                materializationToken: 'materialization-1',
                surfaceToken: 'chatgpt:surface:test',
                selector: { kind: 'text-quote', exact: location.range.toString(), prefix: '', suffix: '' },
            },
        }),
        captureSelection: (selection) => {
            const location = locateSelection(selection);
            return location ? {
                ...location,
                evidence: {
                    target: {
                        documentKey: 'chatgpt:conversation:test',
                        turnId: 'turn-1',
                        userMessageId: 'user-1',
                        assistantMessageId: message.dataset.messageId ?? 'assistant-1',
                    },
                    contentToken: 'content-token-1',
                    materializationToken: 'materialization-1',
                    surfaceToken: 'chatgpt:surface:test',
                    selector: { kind: 'text-quote', exact: location.range.toString(), prefix: '', suffix: '' },
                },
            } : null;
        },
    };
}

describe('ChatGPTPageAnnotationController', () => {
    beforeEach(() => {
        highlightClientMock.listeners.clear(); highlightClientMock.list.mockResolvedValue([]);
        highlightClientMock.create.mockImplementation(async (document, highlight) => ({document, highlight}));
        highlightClientMock.update.mockImplementation(async (document, highlight) => ({document, highlight: {...highlight, revision: highlight.revision + 1, updatedAt: highlight.updatedAt + 1}}));
        highlightClientMock.remove.mockResolvedValue(undefined);
        document.body.innerHTML = '';
        annotationClientMock.listeners.clear();
        annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [] } });
    });

    it('creates a persistent highlight through the selected-text swatch while annotations are disabled', async () => {
        const message = mountMessage('<p>before <strong>plain text</strong> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const code = message.querySelector('strong')!;
        const range = document.createRange(); range.selectNodeContents(code); selectRange(range); mockGeometry(root, code, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {contentSource: createContentSource('before **plain text** after'), materialization: createMaterialization(message), surfaceAdapter: createEvidenceSurfaceAdapter(message)});
        vi.stubGlobal('location', { href: 'https://chatgpt.com/c/test', pathname: '/c/test' });
        document.title = 'ChatGPT';
        controller.setAnnotationsEnabled(false); controller.init();
        try {
            await flushSelectionFrame();
            document.title = '研究笔记';
            dispatchPointerUp(320,240); await flushSelectionFrame();
            expect(selectionToolbarButton('page-comment-add')).toBeNull();
            const blue = selectionToolbarHost()!.querySelector<HTMLButtonElement>('[data-color="blue"]')!;
            expect(blue).toBeTruthy(); blue.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,composed:true})); blue.click();
            await vi.waitFor(() => expect(highlightClientMock.create).toHaveBeenCalledOnce());
            expect(highlightClientMock.create).toHaveBeenCalledWith(expect.objectContaining({conversationId:'test', title:'研究笔记'}), expect.objectContaining({color:'blue',quoteText:'plain text',target:expect.objectContaining({assistantMessageId:'assistant-1'})}));
            expect(annotationClientMock.create).not.toHaveBeenCalled();
            await vi.waitFor(() => expect(selectionToolbarHost()).toBeNull());
        } finally { controller.dispose(); vi.unstubAllGlobals(); document.title = ''; }
    });

    it('saves a cross-paragraph highlight and reanchors its single record after a content remount', async () => {
        const message = mountMessage('<p>First line</p><p>Second line</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const paragraphs = root.querySelectorAll('p');
        const range = document.createRange();
        range.setStart(paragraphs[0]!.firstChild!, 0);
        range.setEnd(paragraphs[1]!.firstChild!, 6);
        selectRange(range);
        mockGeometry(root, paragraphs[0]!, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: createContentSource('unrelated answer'), materialization: createMaterialization(message), surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        controller.init();
        try {
            dispatchPointerUp(320, 240); await flushSelectionFrame();
            const swatch = selectionToolbarHost()?.querySelector<HTMLButtonElement>('[data-color="blue"]');
            expect(swatch).toBeTruthy();
            expect(controller['resolveActionSnapshot']()?.canonicalMarkdown).toBe('First line\n\nSecond');
            expect(controller['store'].getDocument()).not.toBeNull();
            swatch!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, cancelable: true, button: 0 }));
            swatch!.click();
            await vi.waitFor(() => expect(highlightClientMock.create).toHaveBeenCalledOnce());
            const saved = highlightClientMock.create.mock.calls[0]![1];
            expect(saved).toMatchObject({ quoteText: 'First lineSecond', sourceMarkdown: 'First line\n\nSecond' });
            root.innerHTML = '<p>First line</p><p>Second line</p>';
            expect(resolveReaderCommentAnchor(root, saved).range?.toString()).toBe('First lineSecond');
        } finally { controller.dispose(); }
    });

    it.each([
        { label: 'inline code', html: '<p><code>value</code></p>', selector: 'code', expected: '`value`' },
        { label: 'inline formula', html: '<p><span class="katex" data-latex-source="x+y"><span class="katex-html">x+y</span></span></p>', selector: '.katex-html', expected: '$x+y$' },
        { label: 'display formula', html: '<span class="katex-display" data-latex-source="x+y"><span class="katex"><span class="katex-html">x+y</span></span></span>', selector: '.katex-html', expected: '$$\nx+y\n$$' },
    ])('saves a fully selected $label through the visible swatch', async ({ html, selector, expected }) => {
        const message = mountMessage(html);
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const selected = root.querySelector<HTMLElement>(selector)!;
        const range = document.createRange(); range.selectNodeContents(selected); selectRange(range);
        mockGeometry(root, selected, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: createContentSource('unrelated answer'), materialization: createMaterialization(message), surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        controller.init();
        try {
            dispatchPointerUp(320, 240); await flushSelectionFrame();
            const swatch = selectionToolbarHost()?.querySelector<HTMLButtonElement>('[data-color="blue"]');
            expect(swatch).toBeTruthy();
            swatch!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, cancelable: true, button: 0 }));
            swatch!.click();
            await vi.waitFor(() => expect(highlightClientMock.create).toHaveBeenCalledOnce());
            expect(highlightClientMock.create.mock.calls[0]![1].sourceMarkdown).toBe(expected);
        } finally { controller.dispose(); }
    });

    it.each([
        '<p>before</p><div data-markdown-copy="code-block"><code>code block</code></div><p>after</p>',
        '<p>before <span contenteditable="true">editable text</span> after</p>',
    ])('keeps copy and annotation but hides highlight colors for special content: %s', async (html) => {
        const message = mountMessage(html);
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const special = message.querySelector('code, [contenteditable="true"]')!;
        const range = document.createRange(); range.selectNodeContents(special); selectRange(range); mockGeometry(root, special as HTMLElement, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {contentSource:createContentSource(),materialization:createMaterialization(message),surfaceAdapter:createEvidenceSurfaceAdapter(message)});
        controller.init();
        try {
            dispatchPointerUp(320,240); await flushSelectionFrame();
            expect(selectionToolbarButton('page-selection-copy')).not.toBeNull();
            expect(selectionToolbarButton('page-comment-add')).not.toBeNull();
            expect(selectionToolbarHost()?.querySelectorAll('[data-action="highlight-selection"]')).toHaveLength(0);
        } finally { controller.dispose(); }
    });

    it('saves the pointerdown selection when the host changes selection before the highlight click', async () => {
        const message = mountMessage('<p>before <strong>plain text</strong> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const code = message.querySelector('strong')!;
        const range = document.createRange(); range.selectNodeContents(code); selectRange(range); mockGeometry(root, code, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: createContentSource('before **plain text** after'), materialization: createMaterialization(message), surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        controller.init();
        try {
            dispatchPointerUp(320, 240); await flushSelectionFrame();
            const blue = selectionToolbarHost()!.querySelector<HTMLButtonElement>('[data-color="blue"]')!;
            blue.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, cancelable: true, button: 0 }));
            const changed = document.createRange();
            changed.selectNodeContents(root.querySelector('p')!.lastChild!);
            selectRange(changed);
            mockGeometry(root, code, changed);
            document.dispatchEvent(new Event('selectionchange'));
            await flushSelectionFrame();
            blue.click();
            await vi.waitFor(() => expect(highlightClientMock.create).toHaveBeenCalledOnce());
            expect(highlightClientMock.create.mock.calls[0]?.[1]).toMatchObject({ quoteText: 'plain text' });
            expect(document.querySelector('.aimd-toast')?.textContent ?? '').not.toContain('Selection unavailable');
        } finally { controller.dispose(); }
    });

    it('captures a late conversation title through the annotation save popover', async () => {
        vi.stubGlobal('location', { href: 'https://chatgpt.com/c/test', pathname: '/c/test' });
        document.title = 'ChatGPT';
        annotationClientMock.create.mockImplementation(async (document, annotation) => ({ ok: true, data: { document, annotation } }));
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const code = message.querySelector('code')!;
        const range = document.createRange(); range.selectNodeContents(code); selectRange(range); mockGeometry(root, code, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), { contentSource: createContentSource(), materialization: createMaterialization(message), surfaceAdapter: createEvidenceSurfaceAdapter(message) });
        controller.setReaderSettings({ persistAnnotations: true }); controller.init();
        try {
            dispatchPointerUp(320, 240); await flushSelectionFrame();
            selectionToolbarButton('page-comment-add')!.click();
            const shadow = controller['overlay']!.getShadow();
            const textarea = shadow.querySelector('textarea')!;
            textarea.value = 'A note'; textarea.dispatchEvent(new Event('input', { bubbles: true }));
            document.title = '研究笔记';
            shadow.querySelector<HTMLButtonElement>('[data-action="save"]')!.click();
            await vi.waitFor(() => expect(annotationClientMock.create).toHaveBeenCalledWith(expect.objectContaining({ title: '研究笔记', conversationId: 'test' }), expect.objectContaining({ comment: 'A note' })));
        } finally { controller.dispose(); vi.unstubAllGlobals(); document.title = ''; }
    });

    it('retains the selection controls after a failed highlight write and allows retry', async () => {
        const message = mountMessage('<p>before <strong>plain text</strong> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement; const code = message.querySelector('strong')!;
        const range = document.createRange(); range.selectNodeContents(code); selectRange(range); mockGeometry(root,code,range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {contentSource:createContentSource('before **plain text** after'),materialization:createMaterialization(message),surfaceAdapter:createEvidenceSurfaceAdapter(message)});
        controller.init();
        try {
            dispatchPointerUp(320,240); await flushSelectionFrame();
            highlightClientMock.create.mockRejectedValueOnce(new Error('Quota'));
            const red = selectionToolbarHost()!.querySelector<HTMLButtonElement>('[data-color="red"]')!; red.click();
            await vi.waitFor(() => expect(highlightClientMock.create).toHaveBeenCalledTimes(1));
            expect(selectionToolbarHost()).not.toBeNull(); await vi.waitFor(() => expect(red.disabled).toBe(false));
            red.click(); await vi.waitFor(() => expect(selectionToolbarHost()).toBeNull());
            expect(highlightClientMock.create).toHaveBeenCalledTimes(2);
        } finally { controller.dispose(); }
    });

    it('refreshes the page chip and open manager when Reader storage changes', async () => {
        const message = mountMessage('<p>Quoted answer</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        document.body.insertAdjacentHTML('beforeend', '<form><div><button type="button" id="composer-plus-btn">+</button></div><textarea name="prompt-textarea"></textarea></form>');
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), { contentSource: createContentSource(), materialization: createMaterialization(message) });
        controller.init();
        try {
            await vi.waitFor(() => expect(annotationClientMock.listeners.size).toBe(1));
            const range = document.createRange();
            range.selectNodeContents(root);
            const record = createPageCommentRecord({ id: 'reader-note', itemId: 'chatgpt-assistant-1', comment: 'Saved in Reader', range, root, sourceMarkdown: 'Quoted answer' });
            annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [{ document: controller['store'].getDocument()!, annotation: toReaderAnnotationRecord(record, { assistantMessageId: 'assistant-1' }) }] } } as any);
            for (const listener of annotationClientMock.listeners) listener();
            await vi.waitFor(() => expect(document.querySelector('[data-aimd-role="page-annotation-composer-chip"]')).toBeTruthy());
            document.querySelector('[data-aimd-role="page-annotation-composer-chip"]')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
            const shadow = document.querySelector('#aimd-chatgpt-page-annotation-manager-host')!.shadowRoot!;
            expect(shadow.textContent).toContain('Saved in Reader');
            annotationClientMock.list.mockResolvedValue({ ok: true, data: { entries: [] } });
            for (const listener of annotationClientMock.listeners) listener();
            await vi.waitFor(() => expect(shadow.querySelectorAll('.page-annotation-manager__item')).toHaveLength(0));
            expect(document.querySelector('[data-aimd-role="page-annotation-composer-chip"]')).toBeNull();
        } finally { controller.dispose(); }
    });

    it('places the annotation entry beside the current add-context button and opens the existing insert flow', async () => {
        const message = mountMessage('<p>Quoted answer</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        document.body.insertAdjacentHTML('beforeend', '<form data-chatgpt-composer><div class="actions"><span><button type="button" data-composer-navigation-target="add-context" aria-label="添加文件等内容">+</button></span></div><div data-composer-markdown contenteditable="true"></div></form>');
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), { contentSource: createContentSource(), materialization: createMaterialization(message) });
        controller.init();
        try {
            await vi.waitFor(() => expect(controller['store'].getDocument()).not.toBeNull());
            expect(document.querySelector('[data-aimd-role="page-annotation-composer-chip"]')).toBeNull();
            const range = document.createRange(); range.selectNodeContents(root);
            await controller['store'].create(createPageCommentRecord({ id: 'current-note', itemId: 'chatgpt-assistant-1', comment: 'Keep this note', range, root, sourceMarkdown: 'Quoted answer' }), { assistantMessageId: 'assistant-1' });
            const plus = document.querySelector('[data-composer-navigation-target="add-context"]')!;
            const chip = document.querySelector<HTMLElement>('[data-aimd-role="page-annotation-composer-chip"]')!;
            expect(chip.previousElementSibling).toBe(plus.parentElement);
            chip.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
            const shadow = document.querySelector('#aimd-chatgpt-page-annotation-manager-host')!.shadowRoot!;
            expect(shadow.querySelector<HTMLButtonElement>('[data-action="page-annotation-insert-all"]')?.disabled).toBe(false);
        } finally { controller.dispose(); }
    });

    it.each(['success', 'missing-composer', 'delete-failed'])('inserts through the annotation chip and manager (%s)', async (scenario) => {
        const message = mountMessage('<p>Quoted answer</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        document.body.insertAdjacentHTML('beforeend', '<form><div><button type="button" id="composer-plus-btn">+</button></div><textarea name="prompt-textarea">Existing draft</textarea></form>');
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), { contentSource: createContentSource(), materialization: createMaterialization(message) });
        controller.init();
        try {
            await vi.waitFor(() => expect(controller['store'].getDocument()).not.toBeNull());
            const range = document.createRange();
            range.selectNodeContents(root);
            const record = createPageCommentRecord({ id: 'insert-note', itemId: 'chatgpt-assistant-1', comment: 'Keep this note', range, root, sourceMarkdown: 'Quoted answer' });
            await controller['store'].create(record, { assistantMessageId: 'assistant-1' });
            const chip = document.querySelector('[data-aimd-role="page-annotation-composer-chip"]')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
            chip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            chip.click();
            if (scenario === 'missing-composer') document.querySelector('textarea')!.remove();
            if (scenario === 'delete-failed') vi.spyOn(controller['store'], 'removeMany').mockResolvedValue([record]);
            const shadow = document.querySelector('#aimd-chatgpt-page-annotation-manager-host')!.shadowRoot!;
            const button = shadow.querySelector<HTMLButtonElement>('[data-action="page-annotation-insert-and-delete"]')!;
            expect(shadow.querySelector('[data-action="page-annotation-insert-all"]')).toBeTruthy();
            button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            button.click();
            if (scenario === 'success') {
                await vi.waitFor(() => expect(controller['store'].listForConversation()).toHaveLength(0));
                expect(document.querySelector('textarea')!.value).toContain('Existing draft');
                expect(document.querySelector('textarea')!.value).toContain('Keep this note');
            } else if (scenario === 'delete-failed') {
                await vi.waitFor(() => expect(document.querySelector('.aimd-toast')?.textContent).toContain('could not be deleted'));
                expect(controller['store'].listForConversation()).toHaveLength(1);
                expect(document.querySelector('textarea')!.value).toContain('Keep this note');
            } else {
                await vi.waitFor(() => expect(document.querySelector('.aimd-toast')?.textContent).toContain('Could not insert annotations'));
                expect(controller['store'].listForConversation()).toHaveLength(1);
            }
        } finally { controller.dispose(); }
    });

    it('initializes and disposes cleanly without a canonical source', () => {
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        expect(controller['overlay']).toBeNull();
        controller.init();
        controller.setReaderSettings({ persistAnnotations: true, commentExport: undefined });
        controller.setAppearance({ theme: 'dark', overrides: {}, fingerprint: 'f' } as any);
        controller.dispose();
    });

    it('does not retain overlay or selection state while disabled and can re-enable', () => {
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.setEnabled(true);
        expect(controller['overlay']).not.toBeNull();
        controller.setEnabled(false);
        expect(controller['overlay']).toBeNull();
        expect(controller['lastFrame']).toBeNull();
        expect(controller['lastSelection']).toBeNull();
        controller.setEnabled(true);
        expect(controller['overlay']).not.toBeNull();
        controller.dispose();
    });

    it('mounts two independent circular actions beside the mouse release point', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();

        const shadow = selectionToolbarShadow();
        const copyButton = shadow.querySelector<HTMLButtonElement>('[data-action="page-selection-copy"]');
        const commentButton = shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]');
        const toolbar = selectionToolbarHost();
        expect(copyButton).toBeTruthy();
        expect(commentButton).toBeTruthy();
        expect(toolbar?.className).toBe('reader-comment-action');
        expect(toolbar?.style.left).toBe('328px');
        expect(toolbar?.style.top).toBe('248px');
        expect(toolbar?.style.background).toBe('');
        expect(toolbar?.style.border).toBe('');
        expect(copyButton?.getAttribute('aria-label')).toBeTruthy();
        expect(copyButton?.getAttribute('title')).toBe(copyButton?.getAttribute('aria-label'));
        expect(commentButton?.getAttribute('aria-label')).toBeTruthy();
        expect(commentButton?.getAttribute('title')).toBe(commentButton?.getAttribute('aria-label'));
        expect(toolbar?.parentElement?.className).toBe('page-annotation-markers');
        expect(copyButton?.closest('.reader-comment-action')).toBe(toolbar);

        controller.dispose();
    });

    it('does not require ChatGPT official selection UI to show the actions', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();

        expect(selectionToolbarHost()).toBeTruthy();
        expect(selectionToolbarHost()?.style.left).toBe('328px');
        controller.dispose();
    });

    it('uses selection geometry when there is no pointer anchor', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        const toolbar = selectionToolbarHost();
        expect(toolbar?.style.left).toBe('12px');
        expect(toolbar?.style.top).toBe('76px');
        controller.dispose();
    });

    it('flips and clamps the circular actions at the viewport edge', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        const pointerX = window.innerWidth - 4;
        const pointerY = window.innerHeight - 4;
        dispatchPointerDown(pointerX, pointerY);
        dispatchPointerUp(pointerX, pointerY);

        const toolbar = selectionToolbarHost();
        const left = Number.parseFloat(toolbar?.style.left ?? 'NaN');
        const top = Number.parseFloat(toolbar?.style.top ?? 'NaN');
        const buttonSize = controller['readPxVar']('--aimd-size-control-icon-panel', 32);
        const gap = controller['readPxVar']('--aimd-space-2', 8);
        const edge = controller['readPxVar']('--aimd-space-3', 12);
        const actionWidth = buttonSize * 2 + gap;
        expect(left).toBeGreaterThanOrEqual(edge);
        expect(top).toBeGreaterThanOrEqual(edge);
        expect(left + actionWidth).toBeLessThanOrEqual(window.innerWidth - edge);
        expect(top + buttonSize).toBeLessThanOrEqual(window.innerHeight - edge);
        expect(left).toBeLessThan(pointerX);
        expect(top).toBeLessThan(pointerY);
        controller.dispose();
    });

    it('hides the page selection toolbar without disabling page annotations', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();

        controller.setSelectionToolbarEnabled(false);
        expect(selectionToolbarHost()).toBeNull();
        expect(controller['initialized']).toBe(true);

        controller.setSelectionToolbarEnabled(true);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();
        controller.dispose();
    });

    it('reports when a visible selection no longer has a semantic snapshot', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();
        vi.spyOn(controller['markdownResolver'], 'resolve').mockReturnValue(null);

        selectionToolbarButton('page-comment-add')?.click();
        await Promise.resolve();

        expect(document.querySelector<HTMLElement>('.aimd-toast')?.textContent).toContain('Selection unavailable');
        expect(selectionToolbarHost()).toBeNull();
        controller.dispose();
    });

    it('opens annotation editing from live DOM when Repository evidence is stale', async () => {
        const message = mountMessage('<p>before <code>live annotation</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(codeElement);
        selectRange(range);
        mockGeometry(root, codeElement, range);
        const source = createContentSource();
        vi.spyOn(source, 'isCurrent').mockReturnValue(false);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: source,
            materialization: createMaterialization(message),
            surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        try {
            controller.init();
            dispatchPointerUp(320, 240);
            await flushSelectionFrame();
            const shadow = controller['overlay'].getShadow();
            selectionToolbarButton('page-comment-add')?.click();
            await Promise.resolve();

            expect(controller['mode']).toBe('editing');
            expect(shadow.textContent).toContain('live annotation');
            expect(document.querySelector<HTMLElement>('.aimd-toast')?.textContent ?? '').not.toContain('Selection unavailable');
        } finally {
            controller.dispose();
        }
    });

    it('keeps the selected content available when clicking comment collapses native selection first', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();

        const shadow = controller['overlay'].getShadow();
        const commentButton = selectionToolbarButton('page-comment-add');
        expect(commentButton).not.toBeNull();

        // A real browser may dispatch selectionchange between pointerdown and
        // click when focus moves into the Shadow DOM action button. Reproduce
        // that ordering instead of using a bare synthetic click.
        commentButton!.dispatchEvent(new MouseEvent('pointerdown', {
            bubbles: true,
            composed: true,
            cancelable: true,
            button: 0,
        }));
        window.getSelection()?.removeAllRanges();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        commentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]')).not.toBeNull();
        expect(document.querySelector<HTMLElement>('.aimd-toast')).toBeNull();
        controller.dispose();
    });

    it('does not render a toolbar for a collapsed selection', async () => {
        mountMessage('<p>before <code>inline code</code> after</p>');
        const selection = window.getSelection()!;
        selection.removeAllRanges();

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(selectionToolbarHost()).toBeNull();

        controller.dispose();
    });

    it('does not duplicate the toolbar when the same selection fires pointerup twice', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerUp(320, 240);
        dispatchPointerUp(322, 241);
        await flushSelectionFrame();

        expect(selectionToolbarShadow().querySelectorAll('[data-action="page-selection-copy"]')).toHaveLength(1);
        expect(selectionToolbarShadow().querySelectorAll('[data-action="page-comment-add"]')).toHaveLength(1);

        controller.dispose();
    });

    it('recovers the toolbar when the browser ends selection with pointercancel', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerDown(320, 240);
        dispatchPointerCancel(320, 240);
        await flushSelectionFrame();

        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();
        controller.dispose();
    });

    it('does not settle a drag selection from a transient window blur', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerDown(320, 240);
        dispatchWindowBlur();
        selectRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();

        expect(selectionToolbarHost()).toBeNull();

        dispatchPointerUp(320, 240);
        await flushSelectionFrame();
        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        controller.dispose();
    });

    it('defers semantic capture through pointerup and reuses one action snapshot', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        const materialize = vi.spyOn(controller['surfaceAdapter'], 'materializeSelection');
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();
        expect(materialize).not.toHaveBeenCalled();

        selectionToolbarButton('page-selection-copy')?.click();
        await Promise.resolve();
        expect(materialize).toHaveBeenCalledTimes(1);
        selectionToolbarButton('page-comment-add')?.click();
        await Promise.resolve();
        expect(materialize).toHaveBeenCalledTimes(1);

        controller.dispose();
    });

    it('updates shared copy, annotation and highlight visibility on an unchanged selection', async () => {
        const message = mountMessage('<p>selected text</p>');
        const root = message.querySelector<HTMLElement>('.markdown.prose')!;
        const text = message.querySelector<HTMLElement>('p')!;
        const range = document.createRange(); range.selectNodeContents(text);
        selectRange(range); mockGeometry(root, text, range);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter()); controller.init();
        try {
            dispatchPointerUp(320, 240); await flushSelectionFrame();
            controller.setReaderSettings({ selectionToolbar: { copy: false, annotation: true, highlight: false } });
            expect(selectionToolbarButton('page-selection-copy')).toBeNull();
            expect(selectionToolbarButton('page-comment-add')).not.toBeNull();
            expect(selectionToolbarHost()!.querySelector('[data-action="highlight-selection"]')).toBeNull();
            controller.setReaderSettings({ selectionToolbar: { copy: false, annotation: false, highlight: false } });
            expect(selectionToolbarHost()).toBeNull();
            mockGeometry(root, text, controller['selectionCoordinator'].getCurrentFrame()!.location.range);
            controller.setReaderSettings({ selectionToolbar: { copy: true, annotation: true, highlight: true } });
            expect(selectionToolbarButton('page-selection-copy')).not.toBeNull();
        } finally { controller.dispose(); }
    });

    it('copies a literal code fragment through the floating toolbar pointerdown and click path', async () => {
        const message = mountMessage('<pre><code>prefix  $x$\nsuffix</code></pre>');
        const root = message.querySelector<HTMLElement>('.markdown.prose')!;
        const code = message.querySelector<HTMLElement>('code')!;
        const range = document.createRange();
        range.setStart(code.firstChild!, 6);
        range.setEnd(code.firstChild!, 12);
        selectRange(range);
        mockGeometry(root, code, range);
        const copy = vi.spyOn(clipboard, 'copyTextToClipboard').mockResolvedValue(true);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        setCanonicalMarkdownCopyFormulaFormat('raw');
        controller.init();
        try {
            dispatchPointerUp(320, 240);
            await flushSelectionFrame();
            const button = selectionToolbarButton('page-selection-copy')!;
            expect(button).not.toBeNull();
            button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, cancelable: true }));
            button.click();
            await Promise.resolve();
            expect(copy).toHaveBeenCalledWith('  $x$\n');
        } finally {
            controller.dispose();
            copy.mockRestore();
            setCanonicalMarkdownCopyFormulaFormat('markdown-dollar');
        }
    });

    it('can open the same selection again after saving a page annotation', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();

        const shadow = controller['overlay'].getShadow();
        selectionToolbarButton('page-selection-copy')?.click();
        await Promise.resolve();
        selectionToolbarButton('page-comment-add')?.click();
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]');
        expect(input).not.toBeNull();
        input!.value = 'Keep this context';
        input!.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')?.click();
        await vi.waitFor(() => expect(controller['store'].listForConversation()).toHaveLength(1));

        dispatchPointerDown(320, 240);
        selectRange(range);
        dispatchPointerCancel(320, 240);
        await flushSelectionFrame();
        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();

        controller.dispose();
    });

    it('keeps the toolbar available after saving when annotation markers mount into the message root', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        mockGeometry(root, codeElement, range);
        const rangeRects = Range.prototype.getClientRects;
        Object.defineProperty(Range.prototype, 'getClientRects', {
            configurable: true,
            value: () => ([{ left: 40, top: 50, width: 90, height: 18, right: 130, bottom: 68, x: 40, y: 50, toJSON: () => ({}) }]),
        });

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: createContentSource(),
            materialization: createMaterialization(message),
            surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        controller.init();
        dispatchPointerDown(320, 240);
        selectRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();

        const shadow = controller['overlay'].getShadow();
        selectionToolbarButton('page-comment-add')?.click();
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]');
        expect(input).not.toBeNull();
        input!.value = 'Keep this context';
        input!.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')?.click();
        await vi.waitFor(() => expect(controller['store'].listForConversation()).toHaveLength(1));
        expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')).toBeTruthy();

        dispatchPointerDown(320, 240);
        selectRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        await flushSelectionFrame();
        dispatchPointerUp(320, 240);
        await flushSelectionFrame();

        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();
        controller.dispose();
        if (rangeRects) Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: rangeRects });
        else delete (Range.prototype as any).getClientRects;
    });

    it('keeps a pointer toolbar visible when the selected DOM remains connected across a materialization signal', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        selectRange(range);
        mockGeometry(root, codeElement, range);
        const materialization = createSignallingMaterialization(message);
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: createContentSource(),
            materialization,
            surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        controller.init();

        dispatchPointerUp(320, 240);
        await flushSelectionFrame();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();

        materialization.emit('materialization-2');
        await flushSelectionFrame();

        expect(selectionToolbarButton('page-selection-copy')).toBeTruthy();
        expect(selectionToolbarButton('page-comment-add')).toBeTruthy();
        controller.dispose();
    });

    it('reuses marker layout when only the active annotation changes', async () => {
        const message = mountMessage('<p>before <code>inline code</code> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const codeElement = message.querySelector('code') as HTMLElement;
        const codeText = codeElement.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);
        mockGeometry(root, codeElement, range);

        const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
        let layoutReads = 0;
        Object.defineProperty(Range.prototype, 'getClientRects', {
            configurable: true,
            value: () => {
                layoutReads += 1;
                return [{ left: 40, top: 50, width: 90, height: 18, right: 130, bottom: 68, x: 40, y: 50, toJSON: () => ({}) }];
            },
        });

        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {
            contentSource: createContentSource(),
            materialization: createMaterialization(message),
            surfaceAdapter: createEvidenceSurfaceAdapter(message),
        });
        controller.init();

        try {
            await vi.waitFor(() => expect(controller['store'].getDocument()).not.toBeNull());
            const record = createPageCommentRecord({
                id: 'comment-layout-cache',
                itemId: 'chatgpt-assistant-1',
                comment: 'Keep this context',
                range,
                root,
                sourceMarkdown: 'inline code',
            });
            record.target = {
                assistantMessageId: 'assistant-1',
                roundId: 'turn-1',
                userMessageId: 'user-1',
                position: 1,
            };
            await controller['store'].create(record, record.target);

            controller['syncAnnotations']();
            const firstPassReads = layoutReads;
            expect(firstPassReads).toBeGreaterThan(0);

            controller['activeAnnotationId'] = 'comment-layout-cache';
            controller['syncAnnotations']();

            expect(layoutReads).toBe(firstPassReads);

            window.dispatchEvent(new Event('resize'));
            await flushSelectionFrame();
            expect(layoutReads).toBeGreaterThan(firstPassReads);
        } finally {
            controller.dispose();
            if (original) Object.defineProperty(Range.prototype, 'getClientRects', original);
            else delete (Range.prototype as any).getClientRects;
        }
    });

    it('stacks an annotation button and highlight chip and repositions both after a message reflow', async () => {
        const message = mountMessage('<p>before <strong>target text</strong> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const targetText = message.querySelector('strong')!;
        const range = document.createRange(); range.selectNodeContents(targetText); mockGeometry(root, targetText, range);
        let top = 50;
        const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
        Object.defineProperty(Range.prototype, 'getClientRects', {configurable:true, value:() => [{left:40,top,width:90,height:18,right:130,bottom:top+18,x:40,y:top,toJSON:()=>({})}]});
        let resized: ((entries: Array<{target: Element}>) => void) | null = null;
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: (entries: Array<{target: Element}>) => void) { resized = callback; }
            observe() {} unobserve() {} disconnect() {}
        });
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {contentSource:createContentSource('before **target text** after'),materialization:createMaterialization(message),surfaceAdapter:createEvidenceSurfaceAdapter(message)});
        controller.init();
        try {
            await vi.waitFor(() => expect(controller['store'].getDocument()).not.toBeNull());
            const target = {assistantMessageId:'assistant-1',roundId:'turn-1',userMessageId:'user-1',position:1};
            const comment = createPageCommentRecord({id:'comment-one',itemId:'chatgpt-assistant-1',comment:'note',range,root,sourceMarkdown:'target text'});
            await controller['store'].create(comment, target);
            const highlight = createPageCommentRecord({id:'highlight-one',itemId:'chatgpt-assistant-1',comment:'',range,root,sourceMarkdown:'target text'});
            await controller['highlights'].create(createHighlightRecord(highlight, target, 'blue'));
            const shadow = root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')!.shadowRoot!;
            const annotationTop = Number.parseInt(shadow.querySelector<HTMLElement>('.reader-comment-anchor')!.style.top, 10);
            const chip = shadow.querySelector<HTMLElement>('.reader-highlight-anchor')!;
            const chipTop = Number.parseInt(chip.style.top, 10);
            expect(chip.dataset.color).toBe('blue');
            expect(chipTop).toBeGreaterThanOrEqual(annotationTop + 32);

            top = 100;
            resized?.([{target:root}]);
            await flushSelectionFrame();
            expect(Number.parseInt(shadow.querySelector<HTMLElement>('.reader-highlight-anchor')!.style.top, 10)).toBeGreaterThan(chipTop);
        } finally {
            controller.dispose(); vi.unstubAllGlobals();
            if (original) Object.defineProperty(Range.prototype, 'getClientRects', original);
            else delete (Range.prototype as any).getClientRects;
        }
    });

    it('opens four actions from the page highlight marker, then recolors and deletes the same saved record', async () => {
        const message = mountMessage('<p>before <strong>target text</strong> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const targetText = message.querySelector('strong')!;
        const range = document.createRange(); range.selectNodeContents(targetText); mockGeometry(root, targetText, range);
        const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
        Object.defineProperty(Range.prototype, 'getClientRects', {configurable:true, value:() => [{left:40,top:50,width:90,height:18,right:130,bottom:68,x:40,y:50,toJSON:()=>({})}]});
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {contentSource:createContentSource('before **target text** after'),materialization:createMaterialization(message),surfaceAdapter:createEvidenceSurfaceAdapter(message)});
        controller.init();
        try {
            await vi.waitFor(() => expect(controller['store'].getDocument()).not.toBeNull());
            const target = {assistantMessageId:'assistant-1',roundId:'turn-1',userMessageId:'user-1',position:1};
            const highlight = createPageCommentRecord({id:'highlight-action',itemId:'chatgpt-assistant-1',comment:'',range,root,sourceMarkdown:'target text'});
            await controller['highlights'].create(createHighlightRecord(highlight, target, 'blue'));
            const markerShadow = root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')!.shadowRoot!;
            let marker = markerShadow.querySelector<HTMLButtonElement>('.reader-highlight-anchor')!;
            marker.dispatchEvent(new MouseEvent('pointerdown', {bubbles:true,composed:true,button:0}));
            marker.dispatchEvent(new MouseEvent('pointerup', {bubbles:true,composed:true,button:0}));
            marker.click();
            const actionShadow = document.querySelector('#aimd-chatgpt-page-annotation-overlay')!.shadowRoot!;
            expect(actionShadow.querySelectorAll('[data-role="page-highlight-actions"] button')).toHaveLength(4);
            expect(markerShadow.querySelector('.reader-comment-highlight--selected')).toBeTruthy();
            actionShadow.querySelector<HTMLButtonElement>('[data-role="page-highlight-actions"] [data-color="red"]')!.click();
            await vi.waitFor(() => expect(highlightClientMock.update).toHaveBeenCalledOnce());
            expect(highlightClientMock.update.mock.calls[0]![1]).toMatchObject({id:'highlight-action',color:'red',revision:1});
            await vi.waitFor(() => expect(markerShadow.querySelector<HTMLButtonElement>('.reader-highlight-anchor')?.dataset.color).toBe('red'));
            expect(actionShadow.querySelector('[data-role="page-highlight-actions"]')).toBeNull();
            const scrollIntoView = vi.fn();
            Object.assign(targetText, { scrollIntoView });
            Object.assign(root, { getBoundingClientRect: () => ({ left: 0, top: -1000, width: 800, height: 600, right: 800, bottom: -400 }) });
            marker = markerShadow.querySelector<HTMLButtonElement>('.reader-highlight-anchor')!;
            marker.dispatchEvent(new MouseEvent('pointerdown', {bubbles:true,composed:true,button:0}));
            marker.dispatchEvent(new MouseEvent('pointerup', {bubbles:true,composed:true,button:0}));
            marker.click();
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
            await flushSelectionFrame();
            actionShadow.querySelector<HTMLButtonElement>('[data-action="page-highlight-delete"]')!.click();
            await vi.waitFor(() => expect(highlightClientMock.remove).toHaveBeenCalledOnce());
            expect(highlightClientMock.remove.mock.calls[0]![1]).toBe('highlight-action');
            await vi.waitFor(() => expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')).toBeNull());
        } finally {
            controller.dispose();
            if (original) Object.defineProperty(Range.prototype, 'getClientRects', original);
            else delete (Range.prototype as any).getClientRects;
        }
    });

    it('tells the user to refresh when the old page loses its extension context during recoloring', async () => {
        const message = mountMessage('<p>before <strong>target text</strong> after</p>');
        const root = message.querySelector('.markdown.prose') as HTMLElement;
        const targetText = message.querySelector('strong')!;
        const range = document.createRange(); range.selectNodeContents(targetText); mockGeometry(root, targetText, range);
        const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
        Object.defineProperty(Range.prototype, 'getClientRects', {configurable:true, value:() => [{left:40,top:50,width:90,height:18,right:130,bottom:68,x:40,y:50,toJSON:()=>({})}]});
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter(), {contentSource:createContentSource('before **target text** after'),materialization:createMaterialization(message),surfaceAdapter:createEvidenceSurfaceAdapter(message)});
        controller.init();
        try {
            await vi.waitFor(() => expect(controller['store'].getDocument()).not.toBeNull());
            const record = createPageCommentRecord({id:'stale-context-highlight',itemId:'chatgpt-assistant-1',comment:'',range,root,sourceMarkdown:'target text'});
            await controller['highlights'].create(createHighlightRecord(record, {assistantMessageId:'assistant-1'}, 'yellow'));
            highlightClientMock.update.mockRejectedValueOnce(new RuntimeClientRequestError({kind:'transport',code:'CONTEXT_INVALIDATED',message:'Extension context invalidated',delivery:'not-sent'}));
            const marker = root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')!.shadowRoot!.querySelector<HTMLButtonElement>('.reader-highlight-anchor')!;
            marker.dispatchEvent(new MouseEvent('pointerdown', {bubbles:true,composed:true,button:0}));
            marker.click();
            document.querySelector('#aimd-chatgpt-page-annotation-overlay')!.shadowRoot!.querySelector<HTMLButtonElement>('[data-role="page-highlight-actions"] [data-color="blue"]')!.click();
            await vi.waitFor(() => expect(document.querySelector('.aimd-toast')?.textContent).toContain('Refresh this page'));
            expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')!.shadowRoot!.querySelector<HTMLButtonElement>('.reader-highlight-anchor')?.dataset.color).toBe('yellow');
        } finally {
            controller.dispose();
            if (original) Object.defineProperty(Range.prototype, 'getClientRects', original);
            else delete (Range.prototype as any).getClientRects;
        }
    });

    it('reads annotation records once for a combined marker and chip sync', () => {
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.init();
        const list = vi.spyOn(controller['store'], 'listForConversation');

        controller['syncAnnotationSurface']();

        expect(list).toHaveBeenCalledTimes(1);
        controller.dispose();
    });

    it('reuses Reader export composition without adding an implicit Prompt', async () => {
        const controller = new ChatGPTPageAnnotationController(new ChatGPTAdapter());
        controller.setEnabled(true);
        controller.setReaderSettings({
            commentExport: {
                prompts: [{ id: 'selected', title: 'Selected', content: 'Use my annotations.' }],
                template: [
                    { type: 'token', key: 'selected_source' },
                    { type: 'text', value: '\n' },
                    { type: 'token', key: 'user_comment' },
                ],
                promptPosition: 'top',
                sortMode: 'position',
            },
        });
        await controller['store'].create({
            id: 'comment-1',
            itemId: 'chatgpt-assistant-1',
            quoteText: 'Selected quote',
            sourceMarkdown: '**Selected quote**',
            comment: 'Keep this context',
            selectors: {
                textQuote: { exact: 'Selected quote', prefix: '', suffix: '' },
                textPosition: { start: 0, end: 15 },
                domRange: null,
                atomicRefs: [],
            },
            createdAt: 1,
            updatedAt: 1,
        } as any, null);

        expect(controller.composeCurrentAnnotations()).toBe('1. **Selected quote**\n   Keep this context');
        expect(controller.composeCurrentAnnotations('Use my annotations.')).toBe('Use my annotations.\n\n1. **Selected quote**\n   Keep this context');
        controller.dispose();
    });
});
