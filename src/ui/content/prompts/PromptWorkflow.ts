import { filterPromptRecords, type PromptRecord } from '../../../core/prompts/promptLibrary';
import { findPromptTriggerToken, type PromptTriggerToken } from '../../../core/prompts/slashTrigger';
import { findMarkdownMathAt } from '../../../core/sending/markdownMath';
import type { PromptLibraryClient } from '../../../drivers/content/prompts/promptLibraryClient';

export type PromptWorkflowMode = 'autocomplete' | 'manager' | 'edit' | null;

export type PromptWorkflowState = Readonly<{
    mode: PromptWorkflowMode;
    prompts: readonly PromptRecord[] | null;
    suggestions: readonly PromptRecord[];
    activeToken: PromptTriggerToken | null;
    selectedIndex: number;
    managerQuery: string;
    editPrompt: PromptRecord | null;
    statusMessage: string;
}>;

export type PromptAutocompleteRefreshResult = 'open' | 'close' | 'idle';

export type PromptEditorDraft = {
    title: string;
    triggerText: string;
    content: string;
};

function matchesManagerQuery(prompt: PromptRecord, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [prompt.triggerText, prompt.title, prompt.content]
        .some((value) => value.toLowerCase().includes(normalized));
}

function tokenKey(token: PromptTriggerToken): string {
    return `${token.start}:${token.end}:${token.token}`;
}

function createPromptId(now: number): string {
    return `prompt_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Owns Prompt Library state transitions and persistence semantics. UI callers
 * consume one coherent snapshot instead of coordinating cache, filter, CRUD,
 * dismissal, and selection state independently.
 */
export class PromptWorkflow {
    private mode: PromptWorkflowMode = null;
    private promptsCache: PromptRecord[] | null = null;
    private suggestions: PromptRecord[] = [];
    private activeToken: PromptTriggerToken | null = null;
    private dismissedTokenKey: string | null = null;
    private selectedIndex = 0;
    private managerQuery = '';
    private editPrompt: PromptRecord | null = null;
    private statusMessage = '';
    private requestId = 0;

    constructor(private readonly client: PromptLibraryClient) {}

    get state(): PromptWorkflowState {
        return {
            mode: this.mode,
            prompts: this.promptsCache,
            suggestions: this.suggestions,
            activeToken: this.activeToken,
            selectedIndex: this.selectedIndex,
            managerQuery: this.managerQuery,
            editPrompt: this.editPrompt,
            statusMessage: this.statusMessage,
        };
    }

    get managerPrompts(): readonly PromptRecord[] {
        return (this.promptsCache ?? []).filter((prompt) => matchesManagerQuery(prompt, this.managerQuery));
    }

    async refreshAutocomplete(input: {
        text: string;
        caret: number;
        formulaAuthoringEnabled: boolean;
    }): Promise<PromptAutocompleteRefreshResult> {
        if (this.mode === 'manager' || this.mode === 'edit') return 'idle';
        if (input.formulaAuthoringEnabled && findMarkdownMathAt(input.text, input.caret, { includeOpen: true })) {
            this.dismissedTokenKey = null;
            return this.closeAutocompleteIfOpen();
        }

        const token = findPromptTriggerToken(input.text, input.caret);
        if (!token) {
            this.dismissedTokenKey = null;
            return this.closeAutocompleteIfOpen();
        }

        const currentTokenKey = tokenKey(token);
        if (this.dismissedTokenKey === currentTokenKey) {
            return this.closeAutocompleteIfOpen();
        }
        if (this.dismissedTokenKey && this.dismissedTokenKey !== currentTokenKey) {
            this.dismissedTokenKey = null;
        }

        const currentRequest = ++this.requestId;
        const prompts = await this.loadPrompts().catch(() => []);
        if (currentRequest !== this.requestId) return 'idle';
        const nextSuggestions = filterPromptRecords(
            prompts.filter((prompt) => prompt.triggerText.trim()),
            { query: token.query, match: 'trigger' },
        );
        if (nextSuggestions.length < 1) return this.closeAutocompleteIfOpen();

        this.mode = 'autocomplete';
        this.activeToken = token;
        this.suggestions = nextSuggestions;
        this.selectedIndex = Math.min(this.selectedIndex, nextSuggestions.length - 1);
        return 'open';
    }

    async openManager(): Promise<void> {
        this.mode = 'manager';
        this.activeToken = null;
        this.dismissedTokenKey = null;
        this.suggestions = [];
        this.managerQuery = '';
        this.statusMessage = '';
        this.editPrompt = null;
        await this.loadPrompts({ force: true, includeDisabled: true });
    }

    closeSurface(): void {
        this.requestId += 1;
        this.mode = null;
        this.suggestions = [];
        this.activeToken = null;
        this.selectedIndex = 0;
        this.editPrompt = null;
        this.statusMessage = '';
    }

    dismissAutocomplete(): void {
        if (this.activeToken) this.dismissedTokenKey = tokenKey(this.activeToken);
        this.closeSurface();
    }

    moveSelection(delta: number): PromptRecord | null {
        if (this.suggestions.length < 1) return null;
        this.selectedIndex = (this.selectedIndex + delta + this.suggestions.length) % this.suggestions.length;
        return this.suggestions[this.selectedIndex] ?? null;
    }

    selectIndex(index: number): PromptRecord | null {
        const prompt = this.suggestions[index] ?? null;
        if (prompt) this.selectedIndex = index;
        return prompt;
    }

    setManagerQuery(query: string): void {
        this.managerQuery = query;
    }

    beginCreate(title: string, now = Date.now()): PromptRecord {
        this.editPrompt = {
            id: createPromptId(now),
            title,
            content: '',
            triggerText: '',
            contexts: ['composer', 'readerComment'],
            favorite: false,
            enabled: true,
            createdAt: now,
            updatedAt: now,
            lastUsedAt: null,
        };
        this.mode = 'edit';
        return this.editPrompt;
    }

    beginEdit(id: string): PromptRecord | null {
        const prompt = this.findPrompt(id);
        if (!prompt) return null;
        this.editPrompt = { ...prompt, contexts: [...prompt.contexts] };
        this.mode = 'edit';
        return this.editPrompt;
    }

    cancelEdit(): void {
        this.mode = 'manager';
        this.editPrompt = null;
        this.statusMessage = '';
    }

    async toggleEnabled(id: string, enabled: boolean, fallbackMessage: string): Promise<boolean> {
        const prompt = this.findPrompt(id);
        if (!prompt) return false;
        try {
            await this.client.savePrompt({ ...prompt, enabled });
            await this.reloadManagerPrompts();
            this.statusMessage = '';
            return true;
        } catch (error) {
            this.statusMessage = error instanceof Error ? error.message : fallbackMessage;
            return false;
        }
    }

    async delete(id: string, fallbackMessage: string): Promise<boolean> {
        const prompt = this.findPrompt(id);
        if (!prompt) return false;
        try {
            await this.client.deletePrompt(prompt.id);
            await this.reloadManagerPrompts();
            this.statusMessage = '';
            return true;
        } catch (error) {
            this.statusMessage = error instanceof Error ? error.message : fallbackMessage;
            return false;
        }
    }

    async saveEditor(
        draft: PromptEditorDraft,
        messages: { required: string; failed: string },
    ): Promise<boolean> {
        if (!this.editPrompt) return false;
        if (!draft.content.trim()) {
            this.statusMessage = messages.required;
            return false;
        }
        try {
            await this.client.savePrompt({
                ...this.editPrompt,
                ...draft,
                contexts: ['composer', 'readerComment'],
                enabled: this.editPrompt.enabled,
                favorite: this.editPrompt.favorite,
            });
            await this.reloadManagerPrompts();
            this.mode = 'manager';
            this.editPrompt = null;
            this.statusMessage = '';
            return true;
        } catch (error) {
            this.statusMessage = error instanceof Error ? error.message : messages.failed;
            return false;
        }
    }

    reorder(sourceId: string, targetId: string): boolean {
        const prompts = this.promptsCache ?? [];
        const sourceIndex = prompts.findIndex((prompt) => prompt.id === sourceId);
        const targetIndex = prompts.findIndex((prompt) => prompt.id === targetId);
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
        const next = [...prompts];
        const [prompt] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, prompt!);
        this.promptsCache = next;
        return true;
    }

    async persistOrder(fallbackMessage: string): Promise<boolean> {
        if (!this.promptsCache || !this.client.reorderPrompts) return false;
        try {
            this.promptsCache = await this.client.reorderPrompts(this.promptsCache.map((prompt) => prompt.id));
            this.statusMessage = '';
            return true;
        } catch (error) {
            this.statusMessage = error instanceof Error ? error.message : fallbackMessage;
            return false;
        }
    }

    recordUse(id: string): void {
        void this.client.recordUse(id).catch(() => undefined);
    }

    private closeAutocompleteIfOpen(): PromptAutocompleteRefreshResult {
        if (this.mode !== 'autocomplete') return 'idle';
        this.closeSurface();
        return 'close';
    }

    private findPrompt(id: string): PromptRecord | null {
        return (this.promptsCache ?? []).find((prompt) => prompt.id === id) ?? null;
    }

    private async reloadManagerPrompts(): Promise<void> {
        this.promptsCache = null;
        await this.loadPrompts({ force: true, includeDisabled: true });
    }

    private async loadPrompts(options: { force?: boolean; includeDisabled?: boolean } = {}): Promise<PromptRecord[]> {
        if (!options.force && this.promptsCache) return this.promptsCache;
        const prompts = await this.client.listPrompts({
            context: 'all',
            includeDisabled: options.includeDisabled,
        });
        this.promptsCache = prompts;
        return prompts;
    }
}
