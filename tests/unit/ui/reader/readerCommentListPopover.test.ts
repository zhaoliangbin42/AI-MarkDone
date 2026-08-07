import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalHost } from '@/ui/content/components/ModalHost';
import { ReaderCommentListPopover } from '@/ui/content/reader/ReaderCommentListPopover';
import type { ReaderCommentRecord } from '@/services/reader/commentSession';

function comment(id: string, createdAt: number, position: number): ReaderCommentRecord {
    return {
        id,
        itemId: 'item-1',
        quoteText: `Quote ${id}`,
        sourceMarkdown: `Source ${id}`,
        comment: `Comment ${id}`,
        selectors: {
            textQuote: { exact: `Quote ${id}`, prefix: '', suffix: '' },
            textPosition: { start: position, end: position + 5 },
            domRange: null,
            atomicRefs: [],
        },
        createdAt,
        updatedAt: createdAt,
    };
}

describe('ReaderCommentListPopover', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('rolls a rejected sort preference back and exposes the write error inline', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const modalHost = new ModalHost(shadow);
        const popover = new ReaderCommentListPopover();
        popover.open({
            shadow,
            modalHost,
            comments: [comment('created-first', 1, 20), comment('position-first', 2, 5)],
            sortMode: 'created',
            labels: {
                title: 'Annotations',
                close: 'Close',
                empty: 'No annotations',
                error: 'Could not save annotation sorting',
                sortByCreated: 'Created',
                sortByPosition: 'Position',
                selectedSource: 'Selected content',
                userComment: 'Annotation',
                createdAt: 'Created',
                textPosition: 'Position',
                delete: 'Delete',
            },
            onSortChange: vi.fn(async () => {
                throw new Error('Settings write was not confirmed');
            }),
            onSelect: vi.fn(),
            onDelete: vi.fn(),
        });
        await Promise.resolve();

        shadow.querySelector<HTMLButtonElement>('[data-sort-mode="position"]')!.click();

        await vi.waitFor(() => {
            expect(shadow.querySelector<HTMLButtonElement>('[data-sort-mode="created"]')?.dataset.active).toBe('1');
            expect(shadow.querySelector<HTMLButtonElement>('[data-sort-mode="position"]')?.dataset.active).toBe('0');
            const error = shadow.querySelector<HTMLElement>('[data-role="sort-error"]');
            expect(error?.hidden).toBe(false);
            expect(error?.textContent).toBe('Settings write was not confirmed');
        });
    });
});
