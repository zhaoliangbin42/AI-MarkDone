import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalHost } from '@/ui/content/components/ModalHost';
import { PageAnnotationManagerPopover } from '@/ui/content/pageAnnotations/PageAnnotationManagerPopover';
import type { ReaderCommentRecord } from '@/services/reader/commentSession';

function record(id: string, updatedAt = 100): ReaderCommentRecord {
    return {
        id,
        itemId: `chatgpt-${id}`,
        quoteText: `Quote ${id}`,
        sourceMarkdown: `**Quote ${id}**`,
        comment: `Comment ${id}`,
        selectors: {
            textQuote: { exact: `Quote ${id}`, prefix: '', suffix: '' },
            textPosition: { start: 0, end: 8 },
            domRange: null,
            atomicRefs: [],
        },
        createdAt: updatedAt,
        updatedAt,
        target: { assistantMessageId: id, position: 1 },
        revision: 1,
        lastKnownAnchorState: 'anchored',
    };
}

async function openManager(params: {
    getCurrentRecords: () => ReaderCommentRecord[];
    getCurrentLoadFailure?: () => boolean;
    retryCurrent?: () => Promise<void>;
    loadAll?: () => Promise<ReaderCommentRecord[]>;
    onInsertAll?: (records: ReaderCommentRecord[]) => void | Promise<void>;
}) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const modalHost = new ModalHost(shadow);
    const manager = new PageAnnotationManagerPopover();
    const onInsertAll = params.onInsertAll ?? vi.fn();
    manager.open({
        shadow,
        modalHost,
        getCurrentRecords: params.getCurrentRecords,
        getCurrentLoadFailure: params.getCurrentLoadFailure,
        retryCurrent: params.retryCurrent,
        loadAll: params.loadAll ?? (async () => []),
        onSelect: vi.fn(),
        onDelete: vi.fn(async () => true),
        onInsertAll,
    });
    await Promise.resolve();
    return { shadow, modalHost, manager, onInsertAll };
}

describe('PageAnnotationManagerPopover', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('defaults to the current conversation view', async () => {
        const current = record('a');
        const { shadow } = await openManager({
            getCurrentRecords: () => [current],
            loadAll: async () => [current, record('b')],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        const currentTab = dialog.querySelector('[data-view="current"]') as HTMLElement;
        expect(currentTab.dataset.active).toBe('1');
        expect(dialog.querySelectorAll('.page-annotation-manager__item')).toHaveLength(1);
    });

    it('moves and resizes by pointer, clamps to the viewport, and ignores close-button drags', async () => {
        const { shadow, manager } = await openManager({ getCurrentRecords: () => [record('a')] });
        const dialog = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
        const header = dialog.querySelector<HTMLElement>('.mock-modal__head')!;
        const close = header.querySelector<HTMLButtonElement>('button')!;
        vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => ({
            left: Number.parseFloat(dialog.style.left) || 100, top: Number.parseFloat(dialog.style.top) || 80,
            width: Number.parseFloat(dialog.style.width) || 400, height: Number.parseFloat(dialog.style.height) || 420,
            right: 500, bottom: 500, x: 100, y: 80, toJSON: () => ({}),
        }));
        const pointer = (type: string, x: number, y: number) => new MouseEvent(type, { bubbles: true, composed: true, button: 0, clientX: x, clientY: y });
        close.dispatchEvent(pointer('pointerdown', 150, 100)); document.dispatchEvent(pointer('pointermove', 200, 130)); document.dispatchEvent(pointer('pointerup', 200, 130));
        expect(dialog.style.left).toBe('');
        header.dispatchEvent(pointer('pointerdown', 150, 100)); document.dispatchEvent(pointer('pointermove', 210, 130)); document.dispatchEvent(pointer('pointerup', 210, 130));
        expect(dialog.style.left).toBe('160px'); expect(dialog.style.top).toBe('110px');
        const handle = dialog.querySelector<HTMLButtonElement>('[data-action="page-annotation-resize"]');
        expect(handle).not.toBeNull();
        handle!.dispatchEvent(pointer('pointerdown', 500, 500)); document.dispatchEvent(pointer('pointermove', 560, 550)); document.dispatchEvent(pointer('pointerup', 560, 550));
        expect(dialog.style.width).toBe('460px'); expect(dialog.style.height).toBe('470px');
        header.dispatchEvent(pointer('pointerdown', 160, 110)); document.dispatchEvent(pointer('pointermove', -10000, -10000)); document.dispatchEvent(pointer('pointercancel', -10000, -10000));
        expect(Number.parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(0);
        expect(Number.parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(0);
        const previous = dialog.style.left; document.dispatchEvent(pointer('pointermove', 500, 500)); expect(dialog.style.left).toBe(previous);
        manager.close();
    });

    it('restores manually adjusted geometry when reopened and reclamps it to a smaller viewport', async () => {
        const originalWidth = window.innerWidth, originalHeight = window.innerHeight;
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 });
        try {
            const { shadow, modalHost, manager } = await openManager({ getCurrentRecords: () => [record('a')] });
            const dialog = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
            vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => ({ left: Number.parseFloat(dialog.style.left) || 100, top: Number.parseFloat(dialog.style.top) || 80, width: Number.parseFloat(dialog.style.width) || 400, height: Number.parseFloat(dialog.style.height) || 420, right: 500, bottom: 500, x: 100, y: 80, toJSON: () => ({}) }));
            const pointer = (type: string, x: number, y: number) => new MouseEvent(type, { bubbles: true, composed: true, button: 0, clientX: x, clientY: y });
            dialog.querySelector<HTMLElement>('.mock-modal__head')!.dispatchEvent(pointer('pointerdown', 150, 100));
            document.dispatchEvent(pointer('pointermove', 450, 300)); document.dispatchEvent(pointer('pointerup', 450, 300));
            dialog.querySelector<HTMLButtonElement>('[data-action="page-annotation-resize"]')!.dispatchEvent(pointer('pointerdown', 500, 500));
            document.dispatchEvent(pointer('pointermove', 600, 600)); document.dispatchEvent(pointer('pointerup', 600, 600));
            const expected = { left: dialog.style.left, top: dialog.style.top, width: dialog.style.width, height: dialog.style.height };
            manager.close(); await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
            const reopen = () => manager.open({ shadow, modalHost, getCurrentRecords: () => [record('a')], loadAll: async () => [], onSelect: vi.fn(), onDelete: vi.fn(async () => true), onInsertAll: vi.fn() });
            reopen();
            const reopened = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
            expect({ left: reopened.style.left, top: reopened.style.top, width: reopened.style.width, height: reopened.style.height }).toEqual(expected);
            manager.close(); await vi.waitFor(() => expect(reopened.isConnected).toBe(false));
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 450 });
            reopen();
            const narrowed = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
            expect(Number.parseFloat(narrowed.style.left) + Number.parseFloat(narrowed.style.width)).toBeLessThanOrEqual(492);
            expect(Number.parseFloat(narrowed.style.top) + Number.parseFloat(narrowed.style.height)).toBeLessThanOrEqual(442);
            manager.close(); await vi.waitFor(() => expect(narrowed.isConnected).toBe(false));
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 });
            reopen();
            const restored = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
            expect({ left: restored.style.left, top: restored.style.top, width: restored.style.width, height: restored.style.height }).toEqual(expected);
            manager.close();
        } finally {
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
            Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: originalHeight });
        }
    });

    it('keeps a rapid reopen active while the previous close animation completes', async () => {
        const { shadow, modalHost, manager, onInsertAll } = await openManager({ getCurrentRecords: () => [record('a')] });
        const first = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
        first.querySelector<HTMLButtonElement>('[data-action="page-annotation-insert-all"]')!.click();
        manager.open({ shadow, modalHost, getCurrentRecords: () => [record('b')], loadAll: async () => [], onSelect: vi.fn(), onDelete: vi.fn(async () => true), onInsertAll: vi.fn() });
        const second = Array.from(shadow.querySelectorAll<HTMLElement>('.mock-modal--page-annotation-manager')).at(-1)!;
        expect(second).not.toBe(first);
        await vi.waitFor(() => expect(first.isConnected).toBe(false));
        expect(manager.isOpen()).toBe(true);
        expect(onInsertAll).toHaveBeenCalledWith([record('a')]);
        vi.spyOn(second, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 400, height: 420, right: 500, bottom: 520, x: 100, y: 100, toJSON: () => ({}) });
        second.querySelector<HTMLElement>('.mock-modal__head')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(Number.parseFloat(second.style.left)).toBeGreaterThan(100);
        manager.close();
    });

    it('supports keyboard move and resize without breaking the search input', async () => {
        const { shadow, manager } = await openManager({ getCurrentRecords: () => [record('a')] });
        const dialog = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
        const header = dialog.querySelector<HTMLElement>('.mock-modal__head')!;
        vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 400, height: 420, right: 500, bottom: 520, x: 100, y: 100, toJSON: () => ({}) });
        header.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(Number.parseFloat(dialog.style.left)).toBeGreaterThan(100);
        const handle = dialog.querySelector<HTMLButtonElement>('[data-action="page-annotation-resize"]')!;
        handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(Number.parseFloat(dialog.style.width)).toBeGreaterThan(400);
        const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = 'Comment a'; search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(dialog.querySelectorAll('.page-annotation-manager__item')).toHaveLength(1);
        manager.close();
    });

    it('keeps enough height for the header, controls, footer and a readable list when narrowed', async () => {
        const { shadow, manager } = await openManager({ getCurrentRecords: () => [record('a')] });
        const dialog = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
        vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => ({ left: 100, top: 50, width: Number.parseFloat(dialog.style.width) || 600, height: Number.parseFloat(dialog.style.height) || 600, right: 700, bottom: 650, x: 100, y: 50, toJSON: () => ({}) }));
        for (const [selector, height] of [['.mock-modal__head', 68], ['.mock-modal__footer', 64], ['.page-annotation-manager__toolbar', 150], ['[data-role="bulk-actions"]', 90]] as const) {
            const element = dialog.querySelector<HTMLElement>(selector)!;
            vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height, right: 300, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
        }
        const handle = dialog.querySelector<HTMLButtonElement>('[data-action="page-annotation-resize"]')!;
        handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 700, clientY: 650 }));
        document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 420, clientY: 410 }));
        document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
        expect(Number.parseFloat(dialog.style.width)).toBe(320);
        expect(Number.parseFloat(dialog.style.height)).toBeGreaterThanOrEqual(68 + 64 + 150 + 90 + 96);
        manager.close();
    });

    it('enables compact scrolling on initial open in a short viewport', async () => {
        const height = window.innerHeight;
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 300 });
        try {
            const { shadow, manager } = await openManager({ getCurrentRecords: () => [record('a')] });
            const dialog = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
            expect(dialog.dataset.compactViewport).toBe('true');
            manager.close();
        } finally { Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height }); }
    });

    it('reclamps a resized panel when the viewport shrinks and ignores movement after close', async () => {
        const width = window.innerWidth, height = window.innerHeight;
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1200 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 900 });
        try {
            const { shadow, manager } = await openManager({ getCurrentRecords: () => [record('a')] });
            const dialog = shadow.querySelector<HTMLElement>('.mock-modal--page-annotation-manager')!;
            vi.spyOn(dialog, 'getBoundingClientRect').mockImplementation(() => ({ left: Number.parseFloat(dialog.style.left) || 100, top: Number.parseFloat(dialog.style.top) || 80, width: Number.parseFloat(dialog.style.width) || 400, height: Number.parseFloat(dialog.style.height) || 420, right: 500, bottom: 500, x: 100, y: 80, toJSON: () => ({}) }));
            const pointer = (type: string, x: number, y: number) => new MouseEvent(type, { bubbles: true, composed: true, button: 0, clientX: x, clientY: y });
            const handle = dialog.querySelector<HTMLButtonElement>('[data-action="page-annotation-resize"]')!;
            handle.dispatchEvent(pointer('pointerdown', 500, 500));
            document.dispatchEvent(pointer('pointermove', 1000, 850));
            document.dispatchEvent(pointer('pointerup', 1000, 850));
            expect(Number.parseFloat(dialog.style.height)).toBeGreaterThan(640);
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 500 });
            Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 350 });
            window.dispatchEvent(new Event('resize'));
            expect(Number.parseFloat(dialog.style.width)).toBeLessThanOrEqual(484);
            expect(Number.parseFloat(dialog.style.height)).toBeLessThanOrEqual(334);
            expect(Number.parseFloat(dialog.style.left) + Number.parseFloat(dialog.style.width)).toBeLessThanOrEqual(492);
            expect(Number.parseFloat(dialog.style.top) + Number.parseFloat(dialog.style.height)).toBeLessThanOrEqual(342);
            manager.close();
            await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
            const previous = dialog.style.left;
            window.dispatchEvent(new Event('resize'));
            expect(dialog.style.left).toBe(previous);
        } finally {
            Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
            Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
        }
    });

    it('shows a retry state for current-conversation load failures instead of an empty list', async () => {
        let loadFailed = true;
        const retryCurrent = vi.fn(async () => { loadFailed = false; });
        const { shadow } = await openManager({
            getCurrentRecords: () => [],
            getCurrentLoadFailure: () => loadFailed,
            retryCurrent,
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        expect(dialog.querySelector('[data-role="current-load-error"]')?.textContent).toContain('Could not load annotations');
        expect(dialog.querySelector('.page-annotation-manager__empty')).toBeNull();
        (dialog.querySelector('[data-action="page-annotation-retry-current"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(retryCurrent).toHaveBeenCalledOnce());
        await vi.waitFor(() => expect(dialog.querySelector('.page-annotation-manager__empty')).not.toBeNull());
    });

    it('keeps the row DOM stable when the visible query does not change', async () => {
        const current = record('a');
        const { shadow } = await openManager({
            getCurrentRecords: () => [current],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        const row = dialog.querySelector('.page-annotation-manager__item');
        const search = dialog.querySelector('.page-annotation-manager__search') as HTMLInputElement;

        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));

        expect(dialog.querySelector('.page-annotation-manager__item')).toBe(row);
    });

    it('exposes insertion and insertion with deletion only for the current conversation', async () => {
        const current = record('a');
        const { shadow } = await openManager({
            getCurrentRecords: () => [current],
            loadAll: async () => [current, record('b')],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        expect(dialog.querySelector('[data-action="page-annotation-copy-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-delete-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-copy-and-delete"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-insert-and-delete"]')).not.toBeNull();

        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(dialog.querySelector('[data-view="all"]')?.getAttribute('data-active')).toBe('1'));
        expect(dialog.querySelector('[data-action="page-annotation-insert-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-copy-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-delete-all"]')).toBeNull();
        expect(dialog.querySelector('[data-role="all-view-hint"]')?.textContent).toContain('Current conversation');
    });

    it('sends a fixed current-conversation snapshot for insert and delete', async () => {
        const first = record('a'); const second = record('b');
        const records = [first, second];
        const { shadow, onInsertAll } = await openManager({ getCurrentRecords: () => records });
        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = 'Comment a'; search.dispatchEvent(new Event('input', { bubbles: true }));
        const button = dialog.querySelector<HTMLButtonElement>('[data-action="page-annotation-insert-and-delete"]')!;
        expect(button).not.toBeNull();
        button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        button.click();
        await vi.waitFor(() => expect(onInsertAll).toHaveBeenCalledWith([first, second], true));
    });

    it('inserts the whole current conversation even when search hides other rows', async () => {
        const current = record('a');
        const other = record('b');
        const { shadow, onInsertAll } = await openManager({
            getCurrentRecords: () => [current, other],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = 'Comment a';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(dialog.querySelectorAll('.page-annotation-manager__item')).toHaveLength(1);
        (dialog.querySelector('[data-action="page-annotation-insert-all"]') as HTMLButtonElement).click();

        await vi.waitFor(() => expect(onInsertAll).toHaveBeenCalledTimes(1));
        expect(onInsertAll).toHaveBeenCalledWith([current, other]);
        expect(dialog.querySelector('[data-action="page-annotation-insert-all"]')?.textContent).toBe('Insert to input');
    });

    it('ignores a stale all-view read when annotations refresh during loading', async () => {
        let resolveOld!: (records: ReaderCommentRecord[]) => void;
        const loadAll = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValueOnce([record('new')]);
        const { manager, shadow } = await openManager({ getCurrentRecords: () => [], loadAll });
        const all = shadow.querySelector<HTMLButtonElement>('[data-view="all"]')!;
        all.click();
        manager.refresh();
        await vi.waitFor(() => expect(shadow.querySelector('.page-annotation-manager__comment')?.textContent).toBe('Comment new'));
        resolveOld([record('old')]);
        await Promise.resolve();
        expect(shadow.querySelector('.page-annotation-manager__comment')?.textContent).toBe('Comment new');
        manager.close();
    });

    it('shows a retryable error instead of an empty all-annotations state when loading fails', async () => {
        let attempts = 0;
        const { shadow } = await openManager({
            getCurrentRecords: () => [],
            loadAll: async () => {
                attempts += 1;
                throw new Error('storage unavailable');
            },
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(dialog.querySelector('[data-role="all-load-error"]')).toBeTruthy());
        expect(dialog.querySelector('[data-role="all-load-error"]')?.textContent).toContain('Could not load all annotations');
        expect(dialog.querySelector('[data-action="page-annotation-retry-all"]')).toBeTruthy();

        (dialog.querySelector('[data-action="page-annotation-retry-all"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(attempts).toBe(2));
    });

    it('shows and searches the source conversation for all annotations', async () => {
        const current = record('a');
        const other = record('b');
        other.document = {
            platform: 'chatgpt',
            conversationId: 'conversation-b',
            title: 'Research notes',
            lastKnownUrl: 'https://chatgpt.com/c/conversation-b',
        };
        const { shadow } = await openManager({
            getCurrentRecords: () => [current],
            loadAll: async () => [current, other],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(dialog.querySelectorAll('.page-annotation-manager__item')).toHaveLength(2));
        expect(Array.from(dialog.querySelectorAll('.page-annotation-manager__item')).some((item) => item.textContent?.includes('Research notes'))).toBe(true);

        const search = dialog.querySelector('.page-annotation-manager__search') as HTMLInputElement;
        search.value = 'conversation-b';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(dialog.querySelectorAll('.page-annotation-manager__item')).toHaveLength(1);
        expect(dialog.querySelector('.page-annotation-manager__item')?.textContent).toContain('Research notes');
    });

});
