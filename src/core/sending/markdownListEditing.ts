import { parser } from '@lezer/markdown';

export type MarkdownListEdit = {
    start: number;
    end: number;
    replacement: string;
    selectionStart: number;
    selectionEnd: number;
};

export type MarkdownListType = 'ordered' | 'unordered';

type TextChange = {
    from: number;
    to: number;
    insert: string;
};

type OrderedMarker = {
    markerStart: number;
    markerEnd: number;
    bodyStart: number;
    number: number;
    delimiter: '.' | ')';
};

function lineStartAt(text: string, position: number): number {
    return text.lastIndexOf('\n', position - 1) + 1;
}

function lineEndAt(text: string, position: number): number {
    const end = text.indexOf('\n', position);
    return end === -1 ? text.length : end;
}

function columnAt(line: string, offset: number): number {
    let column = 0;
    for (let index = 0; index < offset; index += 1) {
        column = line[index] === '\t' ? column + (4 - (column % 4)) : column + 1;
    }
    return column;
}

function parseOrderedMarkerBeforeCaret(text: string, caret: number): OrderedMarker | null {
    const lineStart = lineStartAt(text, caret);
    const beforeCaret = text.slice(lineStart, caret);
    const match = /^((?:[\t ]{0,3}>[\t ]?)*[\t ]*)(\d{1,9})([.)])([\t ]{1,4})$/.exec(beforeCaret);
    if (!match) return null;
    const markerStart = lineStart + match[1].length;
    return {
        markerStart,
        markerEnd: markerStart + match[2].length + 1,
        bodyStart: caret,
        number: Number.parseInt(match[2], 10),
        delimiter: match[3] as '.' | ')',
    };
}

function parseOrderedMarkerOnLine(text: string, position: number): OrderedMarker | null {
    const lineStart = lineStartAt(text, position);
    const lineEnd = lineEndAt(text, position);
    const match = /^((?:[\t ]{0,3}>[\t ]?)*[\t ]*)(\d{1,9})([.)])([\t ]*)/.exec(text.slice(lineStart, lineEnd));
    if (!match) return null;
    const markerStart = lineStart + match[1].length;
    return {
        markerStart,
        markerEnd: markerStart + match[2].length + 1,
        bodyStart: lineStart + match[0].length,
        number: Number.parseInt(match[2], 10),
        delimiter: match[3] as '.' | ')',
    };
}

function findAncestor(node: ReturnType<ReturnType<typeof parser.parse>['resolveInner']>, name: string) {
    for (let current: typeof node | null = node; current; current = current.parent) {
        if (current.name === name) return current;
    }
    return null;
}

function isInsideCodeBlock(node: ReturnType<ReturnType<typeof parser.parse>['resolveInner']>): boolean {
    return findAncestor(node, 'CodeBlock') !== null || findAncestor(node, 'FencedCode') !== null;
}

export function resolveMarkdownListTypeAt(text: string, caret: number): MarkdownListType | null {
    const tree = parser.parse(text);
    const position = Math.max(0, Math.min(text.length, caret));
    for (const bias of [-1, 1] as const) {
        const resolved = tree.resolveInner(position, bias);
        if (isInsideCodeBlock(resolved)) return null;
        const item = findAncestor(resolved, 'ListItem');
        if (item?.parent?.name === 'OrderedList') return 'ordered';
        if (item?.parent?.name === 'BulletList') return 'unordered';
    }
    return null;
}

function previousListItem(node: ReturnType<ReturnType<typeof parser.parse>['resolveInner']>) {
    for (let current = node.prevSibling; current; current = current.prevSibling) {
        if (current.name === 'ListItem') return current;
    }
    return null;
}

function nextListItem(node: ReturnType<ReturnType<typeof parser.parse>['resolveInner']>) {
    for (let current = node.nextSibling; current; current = current.nextSibling) {
        if (current.name === 'ListItem') return current;
    }
    return null;
}

function resolveListItemAtMarker(
    text: string,
    markerStart: number,
    listName: 'OrderedList' | 'BulletList',
    activeCaret?: number,
) {
    const tree = parser.parse(text);
    const item = findAncestor(tree.resolveInner(markerStart, 1), 'ListItem');
    const listMark = item?.getChild('ListMark');
    if (
        !item
        || item.parent?.name !== listName
        || !listMark
        || listMark.from !== markerStart
    ) return null;
    if (activeCaret !== undefined) {
        const activeNode = tree.resolveInner(activeCaret, -1);
        const activeItem = findAncestor(activeNode, 'ListItem');
        if (
            !activeItem
            || activeItem.from !== item.from
            || activeItem.to !== item.to
            || isInsideCodeBlock(activeNode)
        ) return null;
    }
    return item;
}

function followingSiblingRenumberChanges(
    text: string,
    item: ReturnType<ReturnType<typeof parser.parse>['resolveInner']>,
    delimiter: '.' | ')',
    expectedOriginalNumber: number,
    replacementNumber: number,
): TextChange[] {
    const changes: TextChange[] = [];
    let expected = expectedOriginalNumber;
    let replacement = replacementNumber;
    for (let sibling = nextListItem(item); sibling; sibling = nextListItem(sibling)) {
        const siblingMarker = parseOrderedMarkerOnLine(text, sibling.from);
        if (
            !siblingMarker
            || siblingMarker.delimiter !== delimiter
            || siblingMarker.number !== expected
        ) break;
        changes.push({
            from: siblingMarker.markerStart,
            to: siblingMarker.markerEnd - 1,
            insert: String(replacement),
        });
        expected += 1;
        replacement += 1;
    }
    return changes;
}

function combineChanges(text: string, changes: TextChange[], selection: number): MarkdownListEdit {
    const ordered = [...changes].sort((a, b) => a.from - b.from);
    const start = ordered[0].from;
    const end = ordered[ordered.length - 1].to;
    let replacement = '';
    let cursor = start;
    for (const change of ordered) {
        replacement += text.slice(cursor, change.from);
        replacement += change.insert;
        cursor = change.to;
    }
    replacement += text.slice(cursor, end);
    return {
        start,
        end,
        replacement,
        selectionStart: selection,
        selectionEnd: selection,
    };
}

export function planOrderedListMarkerBackspaceEdit(text: string, caret: number): MarkdownListEdit | null {
    const marker = parseOrderedMarkerBeforeCaret(text, caret);
    if (!marker) return null;

    const item = resolveListItemAtMarker(text, marker.markerStart, 'OrderedList');
    if (!item) return null;
    const itemMarker = parseOrderedMarkerOnLine(text, item.from);
    if (!itemMarker || itemMarker.markerStart !== marker.markerStart) return null;

    const hasPreviousItem = previousListItem(item) !== null;
    const lineStart = lineStartAt(text, caret);
    const line = text.slice(lineStart, lineEndAt(text, caret));
    const markerColumn = columnAt(line, marker.markerStart - lineStart);
    const bodyColumn = columnAt(line, marker.bodyStart - lineStart);
    const placeholder = hasPreviousItem ? ' '.repeat(bodyColumn - markerColumn) : '';
    const changes: TextChange[] = [{
        from: marker.markerStart,
        to: marker.bodyStart,
        insert: placeholder,
    }];

    changes.push(...followingSiblingRenumberChanges(
        text,
        item,
        marker.delimiter,
        marker.number + 1,
        marker.number,
    ));

    const selection = marker.markerStart + placeholder.length;
    return combineChanges(text, changes, selection);
}

function planOrderedListSiblingShiftEdit(
    text: string,
    caret: number,
    baseEdit: MarkdownListEdit,
    shift: -1 | 1,
): MarkdownListEdit | null {
    const marker = parseOrderedMarkerOnLine(text, caret);
    if (!marker || caret < marker.bodyStart) return null;

    const item = resolveListItemAtMarker(text, marker.markerStart, 'OrderedList', caret);
    if (!item) return null;
    const itemMarker = parseOrderedMarkerOnLine(text, item.from);
    if (!itemMarker || itemMarker.markerStart !== marker.markerStart) return null;

    const changes: TextChange[] = [{
        from: baseEdit.start,
        to: baseEdit.end,
        insert: baseEdit.replacement,
    }];
    changes.push(...followingSiblingRenumberChanges(
        text,
        item,
        marker.delimiter,
        marker.number + 1,
        marker.number + 1 + shift,
    ));
    return combineChanges(text, changes, baseEdit.selectionStart);
}

export function planOrderedListEnterEdit(
    text: string,
    caret: number,
    insertion: MarkdownListEdit,
): MarkdownListEdit | null {
    return planOrderedListSiblingShiftEdit(text, caret, insertion, 1);
}

export function planOrderedListExitEdit(
    text: string,
    caret: number,
    removal: MarkdownListEdit,
): MarkdownListEdit | null {
    return planOrderedListSiblingShiftEdit(text, caret, removal, -1);
}

export function planUnorderedListEdit(
    text: string,
    caret: number,
    edit: MarkdownListEdit,
): MarkdownListEdit | null {
    const lineStart = lineStartAt(text, caret);
    const lineEnd = lineEndAt(text, caret);
    const match = /^((?:[\t ]{0,3}>[\t ]?)*[\t ]*)([-+*])([\t ]*)/.exec(text.slice(lineStart, lineEnd));
    if (!match) return null;
    const markerStart = lineStart + match[1].length;

    const item = resolveListItemAtMarker(text, markerStart, 'BulletList', caret);
    const listMark = item?.getChild('ListMark');
    if (
        !item
        || !listMark
        || text.slice(listMark.from, listMark.to) !== match[2]
    ) return null;
    return edit;
}

export function planMarkdownListContinuationEnterEdit(
    text: string,
    caret: number,
    capabilities: { ordered: boolean; unordered: boolean },
): MarkdownListEdit | null {
    const lineStart = lineStartAt(text, caret);
    if (lineStart === 0) return null;

    const tree = parser.parse(text);
    const resolved = tree.resolveInner(caret, -1);
    const item = findAncestor(resolved, 'ListItem');
    if (
        !item
        || (item.parent?.name !== 'OrderedList' && item.parent?.name !== 'BulletList')
        || isInsideCodeBlock(resolved)
    ) return null;
    if (item.parent.name === 'OrderedList' && !capabilities.ordered) return null;
    if (item.parent.name === 'BulletList' && !capabilities.unordered) return null;

    const listMark = item.getChild('ListMark');
    if (!listMark || lineStartAt(text, listMark.from) === lineStart) return null;

    const beforeCaret = text.slice(lineStart, caret);
    const prefix = /^(?:(?:[\t ]{0,3}>[\t ]?)+[\t ]*|[\t ]+)/.exec(beforeCaret)?.[0];
    if (!prefix) return null;

    return {
        start: caret,
        end: caret,
        replacement: `\n${prefix}`,
        selectionStart: caret + prefix.length + 1,
        selectionEnd: caret + prefix.length + 1,
    };
}

export function planOrderedListContinuationBackspaceEdit(
    text: string,
    caret: number,
): MarkdownListEdit | null {
    const lineStart = lineStartAt(text, caret);
    if (lineStart === 0) return null;
    const continuationIndent = text.slice(lineStart, caret);
    if (!/^[\t ]+$/.test(continuationIndent)) return null;

    const previousLineEnd = lineStart - 1;
    const previousLineStart = lineStartAt(text, previousLineEnd);
    if (text.slice(previousLineStart, previousLineEnd).trim().length === 0) return null;

    const tree = parser.parse(text);
    const resolved = tree.resolveInner(caret, 1);
    const item = findAncestor(resolved, 'ListItem');
    const paragraph = findAncestor(resolved, 'Paragraph');
    if (
        !item
        || item.parent?.name !== 'OrderedList'
        || !paragraph
        || paragraph.from >= lineStart
    ) return null;

    const marker = parseOrderedMarkerOnLine(text, item.from);
    if (!marker) return null;
    const itemLineStart = lineStartAt(text, item.from);
    const itemLine = text.slice(itemLineStart, lineEndAt(text, item.from));
    const bodyColumn = columnAt(itemLine, marker.bodyStart - itemLineStart);
    const continuationLine = text.slice(lineStart, lineEndAt(text, caret));
    if (columnAt(continuationLine, caret - lineStart) !== bodyColumn) return null;

    return {
        start: previousLineEnd,
        end: caret,
        replacement: '',
        selectionStart: previousLineEnd,
        selectionEnd: previousLineEnd,
    };
}

export function planOrderedListLinesDeletionEdit(
    text: string,
    start: number,
    end: number,
): MarkdownListEdit | null {
    if (start >= end || lineStartAt(text, start) !== start) return null;
    if (text[end - 1] !== '\n' && end !== text.length) return null;

    const selectedLines = text.slice(start, end).replace(/\n$/, '').split('\n');
    const parsedLines = selectedLines.map((line) => (
        /^([\t ]*)(\d{1,9})([.)])([\t ]+)(.*)$/.exec(line)
    ));
    const first = parsedLines[0];
    if (!first || parsedLines.some((line) => (
        !line || line[1] !== first[1] || line[3] !== first[3]
    ))) return null;

    const firstNumber = Number.parseInt(first[2], 10);
    const delimiter = first[3] as '.' | ')';
    const tree = parser.parse(text);
    const firstMarker = parseOrderedMarkerOnLine(text, start);
    if (!firstMarker) return null;
    const firstItem = findAncestor(tree.resolveInner(firstMarker.markerEnd - 1, 0), 'ListItem');
    if (!firstItem || firstItem.parent?.name !== 'OrderedList') return null;

    let currentItem = firstItem;
    let selectedLineStart = start;
    let structurallyComplete = true;
    for (let index = 0; index < parsedLines.length; index += 1) {
        const parsed = parsedLines[index]!;
        if (Number.parseInt(parsed[2], 10) !== firstNumber + index) {
            structurallyComplete = false;
            break;
        }
        if (index > 0) {
            const sibling = nextListItem(currentItem);
            if (!sibling) {
                structurallyComplete = false;
                break;
            }
            currentItem = sibling;
        }
        const itemMarker = parseOrderedMarkerOnLine(text, currentItem.from);
        const selectedMarkerStart = selectedLineStart + parsed[1].length;
        const selectedLineEnd = lineEndAt(text, selectedLineStart);
        if (
            !itemMarker
            || itemMarker.markerStart !== selectedMarkerStart
        ) {
            structurallyComplete = false;
            break;
        }
        selectedLineStart = selectedLineEnd + 1;
    }

    const changes: TextChange[] = [{ from: start, to: end, insert: '' }];
    if (structurallyComplete) {
        const lastSelectedNumber = Number.parseInt(parsedLines[parsedLines.length - 1]![2], 10);
        changes.push(...followingSiblingRenumberChanges(
            text,
            currentItem,
            delimiter,
            lastSelectedNumber + 1,
            firstNumber,
        ));
    }
    return combineChanges(text, changes, start);
}
