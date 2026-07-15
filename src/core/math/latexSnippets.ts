export type LatexSnippetItem = {
    id: string;
    label: string;
    insertText: string;
    detail: string;
    category: string;
    priority: number;
};

export type LatexSnippetCatalog = {
    version: 1;
    source: {
        project: string;
        commit: string;
        license: string;
    };
    items: LatexSnippetItem[];
};

export type CompiledLatexSnippet = {
    text: string;
    tabStops: Array<{ index: number; start: number; end: number }>;
    finalCursor: number;
};

function readBalancedPlaceholder(source: string, start: number): { body: string; end: number } | null {
    let depth = 1;
    for (let cursor = start; cursor < source.length; cursor += 1) {
        if (source.startsWith('${', cursor)) {
            depth += 1;
            cursor += 1;
        } else if (source[cursor] === '}') {
            depth -= 1;
            if (depth === 0) return { body: source.slice(start, cursor), end: cursor + 1 };
        }
    }
    return null;
}

export function compileLatexSnippet(source: string, selectedText = ''): CompiledLatexSnippet {
    let text = '';
    let finalCursor: number | null = null;
    const tabStops: CompiledLatexSnippet['tabStops'] = [];

    const append = (fragment: string): void => {
        text += fragment;
    };
    const compile = (fragment: string): void => {
        for (let cursor = 0; cursor < fragment.length;) {
            if (fragment.startsWith('$TM_SELECTED_TEXT', cursor)) {
                append(selectedText);
                cursor += '$TM_SELECTED_TEXT'.length;
                continue;
            }
            if (fragment.startsWith('${TM_SELECTED_TEXT}', cursor)) {
                append(selectedText);
                cursor += '${TM_SELECTED_TEXT}'.length;
                continue;
            }
            if (fragment.startsWith('${', cursor)) {
                const placeholder = readBalancedPlaceholder(fragment, cursor + 2);
                if (placeholder) {
                    const match = /^(\d+)(?::([\s\S]*))?$/.exec(placeholder.body);
                    if (match) {
                        const index = Number.parseInt(match[1], 10);
                        const start = text.length;
                        if (match[2]) compile(match[2]);
                        const end = text.length;
                        if (index === 0) finalCursor = start;
                        else tabStops.push({ index, start, end });
                        cursor = placeholder.end;
                        continue;
                    }
                }
            }
            if (fragment[cursor] === '$' && /\d/.test(fragment[cursor + 1] ?? '')) {
                let end = cursor + 1;
                while (/\d/.test(fragment[end] ?? '')) end += 1;
                const index = Number.parseInt(fragment.slice(cursor + 1, end), 10);
                const position = text.length;
                if (index === 0) finalCursor = position;
                else tabStops.push({ index, start: position, end: position });
                cursor = end;
                continue;
            }
            append(fragment[cursor]);
            cursor += 1;
        }
    };

    compile(source);
    tabStops.sort((a, b) => a.index - b.index || a.start - b.start);
    return {
        text,
        tabStops,
        finalCursor: finalCursor ?? text.length,
    };
}

function asNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid LaTeX snippet ${field}.`);
    return value;
}

export function parseLatexSnippetCatalog(value: unknown): LatexSnippetCatalog {
    if (!value || typeof value !== 'object') throw new Error('Invalid LaTeX snippet catalog.');
    const record = value as Record<string, unknown>;
    const source = record.source as Record<string, unknown> | undefined;
    if (record.version !== 1 || !source || !Array.isArray(record.items)) {
        throw new Error('Unsupported LaTeX snippet catalog.');
    }
    const items = record.items.map((raw, index): LatexSnippetItem => {
        if (!raw || typeof raw !== 'object') throw new Error(`Invalid LaTeX snippet item ${index}.`);
        const item = raw as Record<string, unknown>;
        const id = asNonEmptyString(item.id, 'id');
        const label = asNonEmptyString(item.label, 'label');
        if (id.includes('@') || label.startsWith('@')) {
            throw new Error('LaTeX @ shortcuts are not supported.');
        }
        return {
            id,
            label,
            insertText: asNonEmptyString(item.insertText, 'insertText'),
            detail: typeof item.detail === 'string' ? item.detail : '',
            category: asNonEmptyString(item.category, 'category'),
            priority: Number.isFinite(item.priority) ? Number(item.priority) : 0,
        };
    });
    return {
        version: 1,
        source: {
            project: asNonEmptyString(source.project, 'source.project'),
            commit: asNonEmptyString(source.commit, 'source.commit'),
            license: asNonEmptyString(source.license, 'source.license'),
        },
        items,
    };
}

export function searchLatexSnippets(
    catalog: LatexSnippetCatalog,
    query: string,
    limit = 10,
): LatexSnippetItem[] {
    const normalized = query.trim().replace(/^\\/, '').toLowerCase();
    return catalog.items
        .map((item) => {
            const label = item.label.replace(/^\\/, '').toLowerCase();
            const id = item.id.toLowerCase();
            const detail = item.detail.toLowerCase();
            let rank = 4;
            if (!normalized) rank = 3;
            else if (label === normalized || id === normalized) rank = 0;
            else if (label.startsWith(normalized) || id.startsWith(normalized)) rank = 1;
            else if (label.includes(normalized) || id.includes(normalized) || detail.includes(normalized)) rank = 2;
            return { item, rank };
        })
        .filter(({ rank }) => rank < 4)
        .sort((a, b) => a.rank - b.rank || b.item.priority - a.item.priority || a.item.label.localeCompare(b.item.label))
        .slice(0, Math.max(0, limit))
        .map(({ item }) => item);
}
