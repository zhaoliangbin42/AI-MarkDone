import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalHost } from '@/ui/content/components/ModalHost';
import { formatReaderAnnotationExcerpt, ReaderAnnotationManagerPopover } from '@/ui/content/reader/ReaderAnnotationManagerPopover';
import type { ReaderAnnotationListEntry } from '@/contracts/readerAnnotations';

function entry(id: string, conversationId: string, updatedAt: number): ReaderAnnotationListEntry {
    return {
        document: { platform: 'chatgpt', conversationId, title: `Conversation ${conversationId}` },
        annotation: {
            id,
            itemId: `item-${id}`,
            target: { assistantMessageId: `assistant-${id}`, position: 1 },
            quoteText: `Quote ${id}`,
            sourceMarkdown: `Quote ${id}`,
            comment: `Comment ${id}`,
            selectors: {
                textQuote: { exact: `Quote ${id}`, prefix: '', suffix: '' },
                textPosition: { start: 0, end: 8 },
                domRange: null,
                atomicRefs: [],
            },
            createdAt: updatedAt,
            updatedAt,
            revision: 1,
            lastKnownAnchorState: 'anchored',
        },
    };
}

describe('ReaderAnnotationManagerPopover', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('keeps 50 characters at both ends of a long source excerpt', () => {
        const source = `${'前'.repeat(60)}中心内容${'后'.repeat(60)}`;
        expect(formatReaderAnnotationExcerpt(source)).toBe(`${'前'.repeat(50)}…${'后'.repeat(50)}`);
        expect(formatReaderAnnotationExcerpt('short source')).toBe('short source');
    });

    it('supports current/all views, search, grouping and delete confirmation callback', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modalHost = new ModalHost(shadow);
        const current = entry('a', 'conversation-a', 100);
        const other = entry('b', 'conversation-b', 200);
        const onDelete = vi.fn(async () => true);
        const onDeleteMany = vi.fn(async () => true);
        const manager = new ReaderAnnotationManagerPopover();
        manager.open({
            shadow,
            modalHost,
            appearance: {} as any,
            currentDocument: current.document,
            currentEntries: [current],
            loadAll: async () => [current, other],
            labels: {
                title: 'Annotations', close: 'Close', current: 'Current conversation', all: 'All annotations', search: 'Search',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment',
                updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected',
            },
            onSelect: vi.fn(),
            onDelete,
            onDeleteMany,
        });
        await Promise.resolve();
        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        expect(dialog).toBeTruthy();
        const primaryRow = dialog.querySelector('.reader-annotation-manager__toolbar-row--primary');
        expect(primaryRow?.querySelector('[data-view="current"]')).toBeTruthy();
        expect(dialog.querySelector('[data-role="persistence-toggle"]')).toBeNull();
        expect(dialog.querySelector('[data-mode]')).toBeNull();
        expect(dialog.querySelectorAll('[data-view]')).toHaveLength(2);
        expect(dialog.querySelectorAll('.reader-annotation-manager__row')).toHaveLength(1);

        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(dialog.querySelectorAll('.reader-annotation-manager__group')).toHaveLength(2);
        expect(dialog.textContent).toContain('Conversation conversation-b');

        const search = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
        search.value = 'Comment b';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(dialog.querySelectorAll('.reader-annotation-manager__row')).toHaveLength(1);
        (dialog.querySelector('[data-action="delete"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(onDelete).toHaveBeenCalledWith(other);
    });

    it('supports selecting all visible rows and deleting them in one callback', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modalHost = new ModalHost(shadow);
        const first = entry('first', 'conversation-a', 100);
        const second = entry('second', 'conversation-a', 200);
        const onDeleteMany = vi.fn(async () => true);
        const manager = new ReaderAnnotationManagerPopover();
        manager.open({
            shadow,
            modalHost,
            appearance: {} as any,
            currentDocument: first.document,
            currentEntries: [first, second],
            loadAll: async () => [first, second],
            labels: {
                title: 'Annotations', close: 'Close', current: 'Current', all: 'All', search: 'Search',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment', updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected',
            },
            onSelect: vi.fn(),
            onDelete: vi.fn(async () => true),
            onDeleteMany,
        });
        await Promise.resolve();
        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        (dialog.querySelector('.reader-annotation-manager__options > summary') as HTMLElement).click();
        (dialog.querySelector('[data-role="bulk-entry"]') as HTMLButtonElement).click();
        expect(dialog.querySelector('[data-role="bulk-edit"]')?.textContent).toBe('Cancel bulk edit');
        const firstRowSelect = dialog.querySelector<HTMLInputElement>('.reader-annotation-manager__select')!;
        firstRowSelect.click();
        expect((dialog.querySelector('[data-role="select-all"]') as HTMLInputElement).indeterminate).toBe(true);
        (dialog.querySelector('[data-role="select-all"]') as HTMLInputElement).click();
        const deleteSelected = dialog.querySelector<HTMLButtonElement>('[data-role="delete-selected"]')!;
        expect(deleteSelected.disabled).toBe(false);
        deleteSelected.click();
        await Promise.resolve();
        expect(onDeleteMany).toHaveBeenCalledWith([first, second]);
        expect(dialog.querySelectorAll('.reader-annotation-manager__row')).toHaveLength(0);
    });

    it('inverts only visible annotation rows before bulk deletion', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modalHost = new ModalHost(shadow);
        const first = entry('invert-first', 'conversation-a', 100);
        const second = entry('invert-second', 'conversation-a', 200);
        const onDeleteMany = vi.fn(async () => true);
        const manager = new ReaderAnnotationManagerPopover();
        manager.open({
            shadow, modalHost, appearance: {} as any, currentDocument: first.document,
            currentEntries: [first, second], loadAll: async () => [],
            labels: {
                title: 'Annotations', close: 'Close', current: 'Current', all: 'All', search: 'Search',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment', updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', invertSelection: 'Invert selection', deleteSelected: 'Delete selected',
            },
            onSelect: vi.fn(), onDelete: vi.fn(async () => true), onDeleteMany,
        });
        await Promise.resolve();

        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        (dialog.querySelector('.reader-annotation-manager__options > summary') as HTMLElement).click();
        (dialog.querySelector('[data-role="bulk-entry"]') as HTMLButtonElement).click();
        (dialog.querySelector('.reader-annotation-manager__select') as HTMLInputElement).click();
        (dialog.querySelector('[data-role="invert-visible"]') as HTMLButtonElement).click();
        expect([...dialog.querySelectorAll<HTMLInputElement>('.reader-annotation-manager__select')].map(input => input.checked)).toEqual([false, true]);
        (dialog.querySelector('[data-role="delete-selected"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(onDeleteMany).toHaveBeenCalledWith([second]);
    });

    it('keeps loaded historical annotations available when switching conversation scopes', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modalHost = new ModalHost(shadow);
        const current = entry('current', 'conversation-current', 100);
        const other = entry('other', 'conversation-other', 200);
        const manager = new ReaderAnnotationManagerPopover();
        manager.open({
            shadow,
            modalHost,
            appearance: {} as any,
            currentDocument: current.document,
            currentEntries: [current],
            loadAll: async () => [current, other],
            labels: {
                title: 'Annotations', close: 'Close', current: 'Current', all: 'All', search: 'Search',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment', updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected',
            },
            onSelect: vi.fn(),
            onDelete: vi.fn(async () => true),
            onDeleteMany: vi.fn(async () => true),
        });
        await Promise.resolve();
        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(dialog.textContent).toContain('Comment other');

        (dialog.querySelector('[data-view="current"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(dialog.textContent).toContain('Comment current');
        expect(dialog.textContent).not.toContain('Comment other');

        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(dialog.textContent).toContain('Comment current');
        expect(dialog.textContent).toContain('Comment other');
    });
});
