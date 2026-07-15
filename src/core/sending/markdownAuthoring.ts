import {
    planMarkdownListContinuationEnterEdit,
    planOrderedListContinuationBackspaceEdit,
    planOrderedListEnterEdit,
    planOrderedListExitEdit,
    planOrderedListLinesDeletionEdit,
    planOrderedListMarkerBackspaceEdit,
    planUnorderedListEdit,
    resolveMarkdownListTypeAt,
} from './markdownListEditing';

export type MarkdownTextSelection = {
    start: number;
    end: number;
};

export type MarkdownAuthoringEdit = {
    start: number;
    end: number;
    replacement: string;
    selectionStart: number;
    selectionEnd: number;
};

export type MarkdownListCapabilities = {
    ordered: boolean;
    unordered: boolean;
};

const ALL_LIST_CAPABILITIES: MarkdownListCapabilities = {
    ordered: true,
    unordered: true,
};

export function detectMarkdownListTypeAt(
    text: string,
    position: number,
): 'ordered' | 'unordered' | null {
    return resolveMarkdownListTypeAt(text, position);
}

function normalizeSelection(text: string, selection: MarkdownTextSelection): MarkdownTextSelection {
    const clamp = (value: number): number => {
        if (!Number.isFinite(value)) return text.length;
        return Math.max(0, Math.min(text.length, Math.floor(value)));
    };
    const start = clamp(selection.start);
    return {
        start,
        end: Math.max(start, clamp(selection.end)),
    };
}

function isInsideFencedCode(text: string, position: number): boolean {
    let fenceMarker: '`' | '~' | null = null;
    let fenceLength = 0;

    for (const line of text.slice(0, position).split('\n')) {
        const match = /^[\t ]{0,3}(`{3,}|~{3,})/.exec(line);
        if (!match) continue;
        const marker = match[1][0] as '`' | '~';
        if (fenceMarker === null) {
            fenceMarker = marker;
            fenceLength = match[1].length;
        } else if (marker === fenceMarker && match[1].length >= fenceLength) {
            fenceMarker = null;
            fenceLength = 0;
        }
    }

    return fenceMarker !== null;
}

export function planMarkdownBoldEdit(
    text: string,
    selection: MarkdownTextSelection,
): MarkdownAuthoringEdit | null {
    const normalized = normalizeSelection(text, selection);
    if (
        isInsideFencedCode(text, normalized.start)
        || isInsideFencedCode(text, Math.max(normalized.start, normalized.end - 1))
    ) return null;
    const selected = text.slice(normalized.start, normalized.end);
    if (selected.length >= 4 && selected.startsWith('**') && selected.endsWith('**')) {
        const unwrapped = selected.slice(2, -2);
        return {
            start: normalized.start,
            end: normalized.end,
            replacement: unwrapped,
            selectionStart: normalized.start,
            selectionEnd: normalized.start + unwrapped.length,
        };
    }
    if (
        normalized.start >= 2
        && text.slice(normalized.start - 2, normalized.start) === '**'
        && text.slice(normalized.end, normalized.end + 2) === '**'
    ) {
        return {
            start: normalized.start - 2,
            end: normalized.end + 2,
            replacement: selected,
            selectionStart: normalized.start - 2,
            selectionEnd: normalized.end - 2,
        };
    }
    return {
        start: normalized.start,
        end: normalized.end,
        replacement: `**${selected}**`,
        selectionStart: normalized.start + 2,
        selectionEnd: normalized.end + 2,
    };
}

export function planMarkdownEnterEdit(
    text: string,
    selection: MarkdownTextSelection,
    capabilities: MarkdownListCapabilities = ALL_LIST_CAPABILITIES,
): MarkdownAuthoringEdit | null {
    const normalized = normalizeSelection(text, selection);
    if (normalized.start !== normalized.end) return null;
    if (isInsideFencedCode(text, normalized.start)) return null;
    const lineStart = text.lastIndexOf('\n', normalized.start - 1) + 1;
    const lineEndIndex = text.indexOf('\n', normalized.start);
    const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
    const line = text.slice(lineStart, lineEnd);
    const unordered = /^((?:[\t ]{0,3}>[\t ]?)*[\t ]*)([-+*])([\t ]*)(.*)$/.exec(line);
    const ordered = /^((?:[\t ]{0,3}>[\t ]?)*[\t ]*)(\d{1,9})([.)])([\t ]*)(.*)$/.exec(line);
    if (!unordered && !ordered) {
        return planMarkdownListContinuationEnterEdit(text, normalized.start, capabilities);
    }
    if (ordered && !capabilities.ordered) return null;
    if (unordered && !capabilities.unordered) return null;

    const prefix = unordered
        ? `${unordered[1]}${unordered[2]}${unordered[3]}`
        : `${ordered![1]}${Number.parseInt(ordered![2], 10) + 1}${ordered![3]}${ordered![4]}`;
    const currentPrefixLength = unordered
        ? `${unordered[1]}${unordered[2]}${unordered[3]}`.length
        : `${ordered![1]}${ordered![2]}${ordered![3]}${ordered![4]}`.length;
    if (normalized.start - lineStart < currentPrefixLength) return null;

    const body = unordered ? unordered[4] : ordered![5];
    if (body.trim().length === 0) {
        const containerPrefix = unordered ? unordered[1] : ordered![1];
        const preserveContainer = containerPrefix.includes('>');
        const editStart = preserveContainer ? lineStart + containerPrefix.length : lineStart;
        const edit = {
            start: editStart,
            end: lineEnd,
            replacement: '',
            selectionStart: editStart,
            selectionEnd: editStart,
        };
        return ordered
            ? planOrderedListExitEdit(text, normalized.start, edit)
            : planUnorderedListEdit(text, normalized.start, edit);
    }

    let editStart = normalized.start;
    let editEnd = normalized.end;
    if (normalized.start < lineEnd) {
        const before = text[normalized.start - 1] ?? '';
        const atCaret = text[normalized.start] ?? '';
        const after = text[normalized.start + 1] ?? '';
        if (/[\t ]/.test(before) && !/[\t ]/.test(atCaret)) editStart -= 1;
        else if (/[\t ]/.test(atCaret) && !/[\t ]/.test(after)) editEnd += 1;
    }

    const replacement = `\n${prefix}`;
    const edit = {
        start: editStart,
        end: editEnd,
        replacement,
        selectionStart: editStart + replacement.length,
        selectionEnd: editStart + replacement.length,
    };
    return ordered
        ? planOrderedListEnterEdit(text, normalized.start, edit)
        : planUnorderedListEdit(text, normalized.start, edit);
}

export function planMarkdownBackspaceEdit(
    text: string,
    selection: MarkdownTextSelection,
    capabilities: MarkdownListCapabilities = ALL_LIST_CAPABILITIES,
): MarkdownAuthoringEdit | null {
    const normalized = normalizeSelection(text, selection);
    if (normalized.start !== normalized.end || isInsideFencedCode(text, normalized.start)) return null;
    const lineStart = text.lastIndexOf('\n', normalized.start - 1) + 1;
    const beforeCaret = text.slice(lineStart, normalized.start);
    const orderedMarker = /^([\t ]*)(\d+)([.)])([\t ]+)$/.exec(beforeCaret);
    if (orderedMarker && capabilities.ordered) return planOrderedListMarkerBackspaceEdit(text, normalized.start);
    if (capabilities.ordered && /^[\t ]+$/.test(beforeCaret)) {
        return planOrderedListContinuationBackspaceEdit(text, normalized.start);
    }
    if (!capabilities.unordered) return null;
    const marker = /^([\t ]*)[-+*][\t ]+$/.exec(beforeCaret);
    if (!marker) return null;
    const editStart = lineStart + marker[1].length;

    return {
        start: editStart,
        end: normalized.start,
        replacement: '',
        selectionStart: editStart,
        selectionEnd: editStart,
    };
}

export function planMarkdownOrderedListDeletionEdit(
    text: string,
    selection: MarkdownTextSelection,
): MarkdownAuthoringEdit | null {
    const normalized = normalizeSelection(text, selection);
    if (normalized.start === normalized.end || isInsideFencedCode(text, normalized.start)) return null;
    const selectionLineStart = text.lastIndexOf('\n', normalized.start - 1) + 1;
    if (normalized.start !== selectionLineStart) return null;
    const previousCharacter = text[normalized.end - 1];
    if (previousCharacter !== '\n' && normalized.end !== text.length) return null;
    return planOrderedListLinesDeletionEdit(text, normalized.start, normalized.end);
}
