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

    it('atomically replaces a branch while preserving the current stable user identity and options', () => {
        const action = { id: 'copy', label: 'Copy', onClick: vi.fn() };
        const workflow = new ReaderWorkflow();
        workflow.open([
            { id: 'a1', userPrompt: 'A1', content: 'old-1', meta: { position: 1, userMessageId: 'u1', assistantMessageId: 'a1' } },
            { id: 'a2', userPrompt: 'A2', content: 'old-2', meta: { position: 2, userMessageId: 'u2', assistantMessageId: 'a2' } },
            { id: 'a3', userPrompt: 'A3', content: 'old-3', meta: { position: 3, userMessageId: 'u3', assistantMessageId: 'a3' } },
        ], 1, { profile: 'conversation-reader', actions: [action] });

        workflow.replaceItems([
            { id: 'b1', userPrompt: 'B1', content: 'new-1', meta: { position: 1, userMessageId: 'u1', assistantMessageId: 'b1' } },
            { id: 'b2', userPrompt: 'B2', content: 'new-2', meta: { position: 2, userMessageId: 'u2', assistantMessageId: 'b2' } },
        ], { preserveCurrentIdentity: true });

        expect(workflow.items.map((item) => item.id)).toEqual(['b1', 'b2']);
        expect(workflow.index).toBe(1);
        expect(workflow.currentItem?.id).toBe('b2');
        expect(workflow.options).toMatchObject({ profile: 'conversation-reader', actions: [action] });
    });

    it('uses canonical position only as a legacy replacement fallback', () => {
        const workflow = new ReaderWorkflow();
        workflow.open([
            { id: 'legacy-old', userPrompt: 'Old', content: 'old', meta: { position: 2 } },
        ], 0, { profile: 'conversation-reader' });

        workflow.replaceItems([
            { id: 'legacy-new-1', userPrompt: 'New 1', content: 'new-1', meta: { position: 1 } },
            { id: 'legacy-new-2', userPrompt: 'New 2', content: 'new-2', meta: { position: 2 } },
        ], { preserveCurrentIdentity: true });

        expect(workflow.index).toBe(1);
        expect(workflow.currentItem?.id).toBe('legacy-new-2');
    });

    it('does not preserve a canonical Reader item by reused position after its identity disappears', () => {
        const workflow = new ReaderWorkflow();
        workflow.open([
            { id: 'old', userPrompt: 'Old', content: 'old', meta: { position: 2, userMessageId: 'u-old' } },
        ], 0, { profile: 'conversation-reader' });

        workflow.replaceItems([
            { id: 'new-1', userPrompt: 'New 1', content: 'new-1', meta: { position: 1, userMessageId: 'u-new-1' } },
            { id: 'new-2', userPrompt: 'New 2', content: 'new-2', meta: { position: 2, userMessageId: 'u-new-2' } },
        ], { preserveCurrentIdentity: true });

        expect(workflow.index).toBe(0);
        expect(workflow.currentItem?.id).toBe('new-1');
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
