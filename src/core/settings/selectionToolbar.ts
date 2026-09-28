export type SelectionToolbarActions = { copy: boolean; annotation: boolean; highlight: boolean };

export function normalizeSelectionToolbarActions(value: unknown): SelectionToolbarActions {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        copy: typeof record.copy === 'boolean' ? record.copy : true,
        annotation: typeof record.annotation === 'boolean' ? record.annotation : true,
        highlight: typeof record.highlight === 'boolean' ? record.highlight : true,
    };
}
