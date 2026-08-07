export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function hasFields(
    value: unknown,
    stringFields: readonly string[],
    numberFields: readonly string[] = [],
): value is Record<string, unknown> {
    return isRecord(value)
        && stringFields.every((field) => typeof value[field] === 'string')
        && numberFields.every((field) => typeof value[field] === 'number' && Number.isFinite(value[field]));
}

export function readArrayField<T>(
    value: unknown,
    field: string,
    isItem?: (item: unknown) => boolean,
): T[] | null {
    if (!isRecord(value) || !Array.isArray(value[field])) return null;
    const items = value[field] as unknown[];
    return !isItem || items.every(isItem) ? items as T[] : null;
}
