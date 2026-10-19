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
    it('searches manual candidates by title and trigger, including enabled prompts without triggers', async () => {
        const records = [prompt({ id: 'title', title: '整理资料', triggerText: '' }), prompt({ id: 'trigger', title: 'Different', triggerText: '整理' }), prompt({ id: 'disabled', title: '整理 disabled', triggerText: '', enabled: false })];
        const workflow = new PromptWorkflow(client(records));
        expect(await workflow.openSuggestions({ text: '', caret: 0, formulaAuthoringEnabled: false })).toBe('open');
        expect(workflow.state.suggestions.map(item => item.id)).toEqual(['title', 'trigger']);
        expect(await workflow.refreshAutocomplete({ text: '整理', caret: 2, formulaAuthoringEnabled: false, automaticEnabled: false })).toBe('open');
        expect(workflow.state.suggestions.map(item => item.id)).toEqual(['title', 'trigger']);
        workflow.closeSurface();
        expect(await workflow.refreshAutocomplete({ text: '\\整理', caret: 3, formulaAuthoringEnabled: false })).toBe('open');
        expect(workflow.state.suggestions.map(item => item.id)).toEqual(['trigger']);
    });

    it('returns to automatic trigger-prefix matching when moving the caret outside the manual query range', async () => {
        const workflow = new PromptWorkflow(client([
            prompt({ id: 'title-only', title: 'Rewrite explanation', triggerText: 'polish' }),
            prompt({ id: 'prefix', title: 'Different', triggerText: 'rewrite' }),
            prompt({ id: 'contains', title: 'Other', triggerText: 'sprewrite' }),
        ]));
        const text = 'first \\rew';
        expect(await workflow.openSuggestions({ text, caret: 0, formulaAuthoringEnabled: false })).toBe('open');
        expect(workflow.state.manualAutocomplete).toBe(true);
        expect(await workflow.refreshAutocomplete({ text, caret: text.length, formulaAuthoringEnabled: false, automaticEnabled: true })).toBe('open');
        expect(workflow.state.manualAutocomplete).toBe(false);
        expect(workflow.state.suggestions.map(item => item.id)).toEqual(['prefix']);
        expect(workflow.state.activeToken?.token).toBe('\\rew');
    });

    it.each([{ records: [] }, { records: [prompt()] }])('keeps a dismissible manual candidate surface for an empty library or zero matches', async ({ records }) => {
        const workflow = new PromptWorkflow(client(records));
        expect(await workflow.openSuggestions({ text: '', caret: 0, formulaAuthoringEnabled: false })).toBe('open');
        expect(await workflow.refreshAutocomplete({ text: 'no-match', caret: 8, formulaAuthoringEnabled: false, automaticEnabled: false })).toBe('open');
        expect(workflow.state.mode).toBe('autocomplete');
        expect(workflow.state.suggestions).toEqual([]);
        workflow.dismissAutocomplete();
        expect(workflow.state.mode).toBeNull();
    });

    it('opens manual suggestions at an empty caret range without inserting a trigger character', async () => {
        const workflow = new PromptWorkflow(client([prompt(), prompt({ id: 'other', title: 'Summarize', triggerText: 'summarize' })]));
        expect(await workflow.openSuggestions({ text: 'before after', caret: 7, formulaAuthoringEnabled: false })).toBe('open');
        expect(workflow.state.activeToken).toEqual({ start: 7, end: 7, token: '', query: '' });
        expect(workflow.state.suggestions).toHaveLength(2);
        expect(await workflow.refreshAutocomplete({ text: 'before rewafter', caret: 10, formulaAuthoringEnabled: false, automaticEnabled: false })).toBe('open');
        expect(workflow.state.activeToken).toEqual({ start: 7, end: 10, token: 'rew', query: 'rew' });
        expect(workflow.state.suggestions.map(value => value.id)).toEqual(['rewrite']);
        workflow.dismissAutocomplete();
        expect(await workflow.refreshAutocomplete({ text: 'before rewafter', caret: 10, formulaAuthoringEnabled: false, automaticEnabled: false })).toBe('idle');
    });

    it('cancels an outstanding suggestion read when dismissed or when the composer leaves its trigger', async () => {
        let finish!: (prompts: PromptRecord[]) => void;
        const api = client([]);
        api.listPrompts.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const workflow = new PromptWorkflow(api);
        const opening = workflow.openSuggestions({ text: '', caret: 0, formulaAuthoringEnabled: false });
        workflow.closeSurface();
        finish([prompt()]);
        expect(await opening).toBe('idle');
        expect(workflow.state.mode).toBeNull();
    });

    it('keeps a manager load failure distinct from an empty prompt library', async () => {
        const api = client([]);
        api.listPrompts.mockRejectedValueOnce(new Error('Extension context invalidated.'));
        const workflow = new PromptWorkflow(api);

        await workflow.openManager();

        expect(workflow.state.mode).toBe('manager');
        expect(workflow.state.dataState).toBe('error');
        expect(workflow.state.statusMessage).toBe('Extension context invalidated.');
        expect(workflow.managerPrompts).toEqual([]);
    });

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
