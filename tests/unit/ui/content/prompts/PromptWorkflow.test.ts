import { describe, expect, it, vi } from 'vitest';
import type { PromptRecord } from '@/core/prompts/promptLibrary';
import { PromptWorkflow } from '@/ui/content/prompts/PromptWorkflow';

function prompt(patch: Partial<PromptRecord> = {}): PromptRecord {
    return {
        id: patch.id ?? 'rewrite',
        title: patch.title ?? 'Rewrite clearly',
        content: patch.content ?? 'Rewrite this:\n{{cursor}}',
        triggerText: patch.triggerText ?? 'rewrite',
        contexts: patch.contexts ?? ['composer', 'readerComment'],
        favorite: patch.favorite ?? false,
        enabled: patch.enabled ?? true,
        createdAt: patch.createdAt ?? 1,
        updatedAt: patch.updatedAt ?? 1,
        lastUsedAt: patch.lastUsedAt ?? null,
    };
}

function client(prompts: PromptRecord[]) {
    return {
        listPrompts: vi.fn(async () => prompts),
        recordUse: vi.fn(async () => undefined),
        savePrompt: vi.fn(async (next: PromptRecord) => next),
        deletePrompt: vi.fn(async () => undefined),
        restoreDefaults: vi.fn(async () => prompts),
        reorderPrompts: vi.fn(async (ids: string[]) => ids.map((id) => prompts.find((item) => item.id === id)!)),
    };
}

describe('PromptWorkflow', () => {
    it('owns trigger filtering, cache reuse, selection, and same-token dismissal', async () => {
        const records = [
            prompt({ id: 'title-only', title: 'Rewrite', triggerText: 'polish' }),
            prompt({ id: 'trigger', title: 'Different', triggerText: 'rewrite' }),
        ];
        const api = client(records);
        const workflow = new PromptWorkflow(api);

        expect(await workflow.refreshAutocomplete({ text: '\\rew', caret: 4, formulaAuthoringEnabled: false })).toBe('open');
        expect(workflow.state.suggestions.map((item) => item.id)).toEqual(['trigger']);
        expect(workflow.moveSelection(1)?.id).toBe('trigger');

        workflow.dismissAutocomplete();
        expect(await workflow.refreshAutocomplete({ text: '\\rew', caret: 4, formulaAuthoringEnabled: false })).toBe('idle');
        expect(api.listPrompts).toHaveBeenCalledTimes(1);

        expect(await workflow.refreshAutocomplete({ text: '\\rewrite', caret: 8, formulaAuthoringEnabled: false })).toBe('open');
        expect(api.listPrompts).toHaveBeenCalledTimes(1);
    });

    it('keeps manager CRUD, filtering, cache invalidation, and reorder state local to the workflow', async () => {
        const records = [
            prompt({ id: 'one', title: 'One', triggerText: 'one' }),
            prompt({ id: 'two', title: 'Two', triggerText: 'two', enabled: false }),
        ];
        const api = client(records);
        const workflow = new PromptWorkflow(api);

        await workflow.openManager();
        workflow.setManagerQuery('two');
        expect(workflow.managerPrompts.map((item) => item.id)).toEqual(['two']);

        expect(workflow.beginEdit('two')?.id).toBe('two');
        workflow.cancelEdit();
        expect(workflow.state.mode).toBe('manager');

        await workflow.toggleEnabled('two', true, 'Save failed');
        expect(api.savePrompt).toHaveBeenCalledWith(expect.objectContaining({ id: 'two', enabled: true }));

        expect(workflow.reorder('two', 'one')).toBe(true);
        await workflow.persistOrder('Save failed');
        expect(api.reorderPrompts).toHaveBeenCalledWith(['two', 'one']);
    });

    it('owns editor validation and save failure status without leaking client errors to rendering', async () => {
        const records = [prompt()];
        const api = client(records);
        const workflow = new PromptWorkflow(api);
        await workflow.openManager();
        workflow.beginCreate('Untitled', 10);

        expect(await workflow.saveEditor({ title: 'New', triggerText: 'new', content: '   ' }, {
            required: 'Content required',
            failed: 'Save failed',
        })).toBe(false);
        expect(workflow.state.statusMessage).toBe('Content required');

        api.savePrompt.mockRejectedValueOnce(new Error('Storage unavailable'));
        expect(await workflow.saveEditor({ title: 'New', triggerText: 'new', content: 'Body' }, {
            required: 'Content required',
            failed: 'Save failed',
        })).toBe(false);
        expect(workflow.state.statusMessage).toBe('Storage unavailable');
        expect(workflow.state.mode).toBe('edit');
    });
});
