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

    it('keeps only current-view insertion and removes page-level bulk copy/delete actions', async () => {
        const current = record('a');
        const { shadow } = await openManager({
            getCurrentRecords: () => [current],
            loadAll: async () => [current, record('b')],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        expect(dialog.querySelector('[data-action="page-annotation-copy-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-delete-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-copy-and-delete"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-insert-and-delete"]')).toBeNull();

        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(dialog.querySelector('[data-view="all"]')?.getAttribute('data-active')).toBe('1'));
        expect(dialog.querySelector('[data-action="page-annotation-insert-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-copy-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-delete-all"]')).toBeNull();
        expect(dialog.querySelector('[data-role="all-view-hint"]')?.textContent).toContain('Current conversation');
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
