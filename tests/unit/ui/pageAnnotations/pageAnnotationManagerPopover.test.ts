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

        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(dialog.querySelector('[data-view="all"]')?.getAttribute('data-active')).toBe('1'));
        expect(dialog.querySelector('[data-action="page-annotation-insert-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-copy-all"]')).toBeNull();
        expect(dialog.querySelector('[data-action="page-annotation-delete-all"]')).toBeNull();
        expect(dialog.querySelector('[data-role="all-view-hint"]')?.textContent).toContain('Current conversation');
    });

    it('closes and inserts all annotations into the composer on insert click', async () => {
        const current = record('a');
        const { shadow, onInsertAll } = await openManager({
            getCurrentRecords: () => [current],
        });

        const dialog = shadow.querySelector('.mock-modal--page-annotation-manager') as HTMLElement;
        (dialog.querySelector('[data-action="page-annotation-insert-all"]') as HTMLButtonElement).click();

        await vi.waitFor(() => expect(onInsertAll).toHaveBeenCalledTimes(1));
        expect(onInsertAll).toHaveBeenCalledWith([current]);
        expect(dialog.querySelector('[data-action="page-annotation-insert-all"]')?.textContent).toBe('Insert to input');
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
