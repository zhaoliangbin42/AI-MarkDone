import { describe, expect, it, vi } from 'vitest';

import { ReaderWorkflow } from '@/ui/content/reader/ReaderWorkflow';

const ITEMS = [
    { id: 'a', userPrompt: 'A', content: 'one' },
    { id: 'b', userPrompt: 'B', content: 'two' },
    { id: 'c', userPrompt: 'C', content: 'three' },
];

describe('ReaderWorkflow', () => {
    it('opens at a clamped index and resolves the conversation profile in one state transition', () => {
        const workflow = new ReaderWorkflow();

        workflow.open(ITEMS, 99, { profile: 'conversation-reader' });

        expect(workflow.index).toBe(2);
        expect(workflow.currentItem?.id).toBe('c');
        expect(workflow.options).toMatchObject({
            profile: 'conversation-reader',
            showNav: true,
            showCopy: true,
            showOpenConversation: false,
            dotStyle: 'meta',
        });
    });

    it('owns navigation boundaries, append behavior, and defensive item snapshots', () => {
        const workflow = new ReaderWorkflow();
        workflow.open(ITEMS, 1);

        expect(workflow.move(-1)).toBe(true);
        expect(workflow.index).toBe(0);
        expect(workflow.move(-1)).toBe(false);
        expect(workflow.jump(999)).toBe(true);
        expect(workflow.index).toBe(2);

        workflow.append({ id: 'd', userPrompt: 'D', content: 'four' });
        const snapshot = workflow.getItemsSnapshot();
        snapshot.pop();

        expect(workflow.items).toHaveLength(4);
        expect(workflow.index).toBe(2);
    });

    it('preserves bookmark-preview callbacks and actions without leaking profile defaults to callers', () => {
        const onOpenConversation = vi.fn();
        const onRequestClose = vi.fn();
        const action = { id: 'save', label: 'Save', onClick: vi.fn() };
        const workflow = new ReaderWorkflow();

        workflow.open(ITEMS, 0, {
            profile: 'bookmark-preview',
            onOpenConversation,
            onRequestClose,
            actions: [action],
        });

        expect(workflow.options).toMatchObject({
            profile: 'bookmark-preview',
            showOpenConversation: true,
            dotStyle: 'plain',
            onOpenConversation,
            onRequestClose,
        });
        expect(workflow.options.actions).toEqual([action]);
    });
});
