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
                byConversation: 'By conversation', timeline: 'Timeline', empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment',
                updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected',
                persistence: 'Persist annotations', persistenceTooltip: 'Keep annotations',
            },
            onSelect: vi.fn(),
            onDelete,
            onDeleteMany,
            persistenceEnabled: true,
            onPersistenceChange: vi.fn(),
        });
        await Promise.resolve();
        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        expect(dialog).toBeTruthy();
        const primaryRow = dialog.querySelector('.reader-annotation-manager__toolbar-row--primary');
        expect(primaryRow?.querySelector('[data-view="current"]')).toBeTruthy();
        expect(primaryRow?.querySelector('[data-role="persistence-toggle"]')).toBeTruthy();
        expect(primaryRow?.querySelector('.reader-annotation-manager__persistence-help')?.getAttribute('aria-label')).toBe('Keep annotations');
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
                title: 'Annotations', close: 'Close', current: 'Current', all: 'All', search: 'Search', byConversation: 'By conversation', timeline: 'Timeline',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment', updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected', persistence: 'Persist annotations', persistenceTooltip: 'Keep annotations',
            },
            onSelect: vi.fn(),
            onDelete: vi.fn(async () => true),
            onDeleteMany,
            persistenceEnabled: true,
            onPersistenceChange: vi.fn(),
        });
        await Promise.resolve();
        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        (dialog.querySelector('[data-role="bulk-edit"]') as HTMLButtonElement).click();
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

    it('exposes the persistence toggle and delegates the preference change', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modalHost = new ModalHost(shadow);
        const onPersistenceChange = vi.fn(async () => undefined);
        const manager = new ReaderAnnotationManagerPopover();
        const current = entry('toggle', 'conversation-toggle', 100);
        manager.open({
            shadow,
            modalHost,
            appearance: {} as any,
            currentDocument: current.document,
            currentEntries: [],
            loadAll: async () => [],
            labels: {
                title: 'Annotations', close: 'Close', current: 'Current', all: 'All', search: 'Search', byConversation: 'By conversation', timeline: 'Timeline',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment', updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected', persistence: 'Persist annotations', persistenceTooltip: 'Keep annotations',
            },
            onSelect: vi.fn(),
            onDelete: vi.fn(async () => true),
            onDeleteMany: vi.fn(async () => true),
            persistenceEnabled: false,
            onPersistenceChange,
        });
        await Promise.resolve();
        const toggle = shadow.querySelector<HTMLInputElement>('[data-role="persistence-toggle"]')!;
        const help = shadow.querySelector<HTMLButtonElement>('.reader-annotation-manager__persistence-help');
        expect(help?.dataset.tooltip).toBe('Keep annotations');
        expect(help?.dataset.tooltipVariant).toBe('preview');
        expect(help?.getAttribute('aria-label')).toBe('Keep annotations');
        toggle.click();
        await Promise.resolve();
        expect(onPersistenceChange).toHaveBeenCalledWith(true);
        expect(toggle.checked).toBe(true);
    });

    it('does not hide loaded annotations when persistence for new annotations is turned off', async () => {
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
                title: 'Annotations', close: 'Close', current: 'Current', all: 'All', search: 'Search', byConversation: 'By conversation', timeline: 'Timeline',
                empty: 'Empty', loading: 'Loading', error: 'Error', quote: 'Quote', comment: 'Comment', updated: 'Updated', reply: 'Reply', unanchored: 'Not located', delete: 'Delete',
                bulkEdit: 'Bulk edit', bulkCancel: 'Cancel bulk edit', selectAll: 'Select all', deleteSelected: 'Delete selected', persistence: 'Persist annotations', persistenceTooltip: 'Saved annotations stay visible',
            },
            onSelect: vi.fn(),
            onDelete: vi.fn(async () => true),
            onDeleteMany: vi.fn(async () => true),
            persistenceEnabled: true,
            onPersistenceChange: vi.fn(async () => undefined),
        });
        await Promise.resolve();
        const dialog = shadow.querySelector('.mock-modal--reader-annotation-manager') as HTMLElement;
        (dialog.querySelector('[data-view="all"]') as HTMLButtonElement).click();
        await Promise.resolve();
        expect(dialog.textContent).toContain('Comment other');

        (dialog.querySelector('[data-role="persistence-toggle"]') as HTMLInputElement).click();
        await Promise.resolve();

        expect(dialog.textContent).toContain('Comment current');
        expect(dialog.textContent).toContain('Comment other');
    });
});
