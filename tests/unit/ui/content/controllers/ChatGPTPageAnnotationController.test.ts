import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import type { ConversationContentSourceV1 } from '@/contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '@/contracts/conversationMaterialization';
import { DOMContentSurfaceAdapter, type ContentSurfaceAdapter } from '@/drivers/content/adapters/ContentSurfaceAdapter';
import { ChatGPTPageAnnotationController } from '@/ui/content/controllers/ChatGPTPageAnnotationController';
import { createPageCommentRecord } from '@/services/reader/commentAnchoring';

const annotationClientMock = vi.hoisted(() => ({
    list: vi.fn(async () => ({ ok: true, data: { entries: [] } })),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
}));

vi.mock('@/drivers/shared/clients/readerAnnotationsClient', () => ({
    readerAnnotationsClient: annotationClientMock,
    subscribeReaderAnnotationChanges: () => () => undefined,
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

function createContentSource(): ConversationContentSourceV1 {
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
            assistantMarkdown: 'before **inline code** after',
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
        document.body.innerHTML = '';
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

    it('positions a copy + comment toolbar beside the pointer release position', async () => {
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
        const copyButton = shadow.querySelector<HTMLButtonElement>('[data-action="page-selection-copy"]');
        const commentButton = shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]');
        expect(copyButton).toBeTruthy();
        expect(commentButton).toBeTruthy();
        expect(copyButton?.getAttribute('aria-label')).toBeTruthy();
        expect(copyButton?.getAttribute('title')).toBe(copyButton?.getAttribute('aria-label'));
        expect(commentButton?.getAttribute('aria-label')).toBeTruthy();
        expect(commentButton?.getAttribute('title')).toBe(commentButton?.getAttribute('aria-label'));
        const toolbar = shadow.querySelector<HTMLElement>('.reader-comment-action');
        expect(toolbar?.style.left).toBe('328px');
        expect(toolbar?.style.top).toBe('248px');

        controller.dispose();
    });

    it('uses selection geometry only when no pointer anchor exists', async () => {
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

        const toolbar = controller['overlay'].getShadow().querySelector<HTMLElement>('.reader-comment-action');
        expect(toolbar?.style.left).toBe('49px');
        expect(toolbar?.style.top).toBe('76px');
        controller.dispose();
    });

    it('flips and clamps the pointer toolbar at the viewport edge', async () => {
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

        const toolbar = controller['overlay'].getShadow().querySelector<HTMLElement>('.reader-comment-action');
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

        const shadow = controller['overlay'].getShadow();
        shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]')?.click();
        await Promise.resolve();

        expect(document.querySelector<HTMLElement>('.aimd-toast')?.textContent).toContain('Selection unavailable');
        expect(shadow.querySelector('[data-action="page-comment-add"]')).toBeNull();
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
            shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]')?.click();
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
        const commentButton = shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]');
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

        const shadow = controller['overlay'].getShadow();
        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeNull();

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

        const shadow = controller['overlay'].getShadow();
        expect(shadow.querySelectorAll('[data-action="page-selection-copy"]')).toHaveLength(1);
        expect(shadow.querySelectorAll('[data-action="page-comment-add"]')).toHaveLength(1);

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

        const shadow = controller['overlay'].getShadow();
        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="page-comment-add"]')).toBeTruthy();
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

        const shadow = controller['overlay'].getShadow();
        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeNull();

        dispatchPointerUp(320, 240);
        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeTruthy();
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

        const shadow = controller['overlay'].getShadow();
        shadow.querySelector<HTMLButtonElement>('[data-action="page-selection-copy"]')?.click();
        await Promise.resolve();
        expect(materialize).toHaveBeenCalledTimes(1);
        shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]')?.click();
        await Promise.resolve();
        expect(materialize).toHaveBeenCalledTimes(1);

        controller.dispose();
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
        shadow.querySelector<HTMLButtonElement>('[data-action="page-selection-copy"]')?.click();
        await Promise.resolve();
        shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]')?.click();
        const input = shadow.querySelector<HTMLTextAreaElement>('[data-role="input"]');
        expect(input).not.toBeNull();
        input!.value = 'Keep this context';
        input!.dispatchEvent(new Event('input', { bubbles: true }));
        shadow.querySelector<HTMLButtonElement>('[data-action="save"]')?.click();
        await vi.waitFor(() => expect(controller['store'].listForConversation()).toHaveLength(1));

        dispatchPointerDown(320, 240);
        selectRange(range);
        dispatchPointerCancel(320, 240);
        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="page-comment-add"]')).toBeTruthy();

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

        const shadow = controller['overlay'].getShadow();
        shadow.querySelector<HTMLButtonElement>('[data-action="page-comment-add"]')?.click();
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

        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="page-comment-add"]')).toBeTruthy();
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
        const shadow = controller['overlay'].getShadow();
        expect(shadow.querySelector('[data-action="page-comment-add"]')).toBeTruthy();

        materialization.emit('materialization-2');
        await flushSelectionFrame();

        expect(shadow.querySelector('[data-action="page-selection-copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="page-comment-add"]')).toBeTruthy();
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
