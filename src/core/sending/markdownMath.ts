export type MarkdownMathKind = 'inline' | 'display';

export type MarkdownMathRange = {
    kind: MarkdownMathKind;
    delimiter: '$' | '$$';
    start: number;
    end: number;
    contentStart: number;
    contentEnd: number;
    source: string;
    closed: boolean;
};

export type LatexCommandToken = {
    start: number;
    end: number;
    query: string;
    math: MarkdownMathRange;
};

function isEscaped(text: string, index: number): boolean {
    let slashes = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1;
    return slashes % 2 === 1;
}

function markRange(mask: Uint8Array, start: number, end: number): void {
    mask.fill(1, Math.max(0, start), Math.min(mask.length, end));
}

function createCodeMask(text: string): Uint8Array {
    const mask = new Uint8Array(text.length);
    let lineStart = 0;
    let fence: { marker: '`' | '~'; length: number } | null = null;

    while (lineStart <= text.length) {
        const newline = text.indexOf('\n', lineStart);
        const lineEnd = newline === -1 ? text.length : newline;
        const line = text.slice(lineStart, lineEnd);
        const fenceMatch = /^[\t ]{0,3}(`{3,}|~{3,})/.exec(line);
        if (fence) {
            markRange(mask, lineStart, newline === -1 ? lineEnd : lineEnd + 1);
            if (
                fenceMatch
                && fenceMatch[1][0] === fence.marker
                && fenceMatch[1].length >= fence.length
            ) fence = null;
        } else if (fenceMatch) {
            fence = {
                marker: fenceMatch[1][0] as '`' | '~',
                length: fenceMatch[1].length,
            };
            markRange(mask, lineStart, newline === -1 ? lineEnd : lineEnd + 1);
        } else {
            let cursor = lineStart;
            while (cursor < lineEnd) {
                if (text[cursor] !== '`' || isEscaped(text, cursor)) {
                    cursor += 1;
                    continue;
                }
                let runEnd = cursor + 1;
                while (runEnd < lineEnd && text[runEnd] === '`') runEnd += 1;
                const marker = text.slice(cursor, runEnd);
                const close = text.indexOf(marker, runEnd);
                const closeInLine = close >= runEnd && close < lineEnd;
                const maskedEnd = closeInLine ? close + marker.length : lineEnd;
                markRange(mask, cursor, maskedEnd);
                cursor = maskedEnd;
            }
        }
        if (newline === -1) break;
        lineStart = newline + 1;
    }
    return mask;
}

function canOpenInline(text: string, index: number): boolean {
    const next = text[index + 1] ?? '';
    return Boolean(next) && next !== '$' && !/\s/.test(next);
}

function canCloseInline(text: string, index: number): boolean {
    const previous = text[index - 1] ?? '';
    return Boolean(previous) && previous !== '$' && !/\s/.test(previous);
}

function findClosingDelimiter(
    text: string,
    mask: Uint8Array,
    from: number,
    kind: MarkdownMathKind,
): number {
    const delimiter = kind === 'display' ? '$$' : '$';
    const lineEnd = kind === 'inline' ? (text.indexOf('\n', from) === -1 ? text.length : text.indexOf('\n', from)) : text.length;
    for (let cursor = from; cursor < lineEnd; cursor += 1) {
        if (mask[cursor] || text[cursor] !== '$' || isEscaped(text, cursor)) continue;
        if (kind === 'display') {
            if (text.slice(cursor, cursor + 2) === delimiter && !mask[cursor + 1]) return cursor;
            continue;
        }
        if (text[cursor + 1] !== '$' && text[cursor - 1] !== '$' && canCloseInline(text, cursor)) return cursor;
    }
    return -1;
}

function collectMarkdownMath(text: string, includeOpen: boolean): MarkdownMathRange[] {
    const mask = createCodeMask(text);
    const ranges: MarkdownMathRange[] = [];
    for (let cursor = 0; cursor < text.length; cursor += 1) {
        if (mask[cursor] || text[cursor] !== '$' || isEscaped(text, cursor)) continue;
        const display = text[cursor + 1] === '$' && !mask[cursor + 1];
        if (!display && !canOpenInline(text, cursor)) continue;
        const kind: MarkdownMathKind = display ? 'display' : 'inline';
        const delimiter = display ? '$$' : '$';
        const contentStart = cursor + delimiter.length;
        const close = findClosingDelimiter(text, mask, contentStart, kind);
        if (close < 0 && !includeOpen) continue;
        const contentEnd = close < 0
            ? (kind === 'inline' && text.indexOf('\n', contentStart) >= 0
                ? text.indexOf('\n', contentStart)
                : text.length)
            : close;
        const end = close < 0 ? contentEnd : close + delimiter.length;
        ranges.push({
            kind,
            delimiter,
            start: cursor,
            end,
            contentStart,
            contentEnd,
            source: text.slice(contentStart, contentEnd),
            closed: close >= 0,
        });
        cursor = Math.max(cursor, end - 1);
    }
    return ranges;
}

export function scanMarkdownMath(text: string): MarkdownMathRange[] {
    return collectMarkdownMath(text, false);
}

export function findMarkdownMathAt(
    text: string,
    index: number,
    options: { includeOpen?: boolean } = {},
): MarkdownMathRange | null {
    const position = Math.max(0, Math.min(text.length, Math.floor(index)));
    return collectMarkdownMath(text, Boolean(options.includeOpen)).find((range) => (
        position >= range.contentStart && position <= range.contentEnd
    )) ?? null;
}

export function findLatexCommandToken(text: string, cursor: number): LatexCommandToken | null {
    const end = Math.max(0, Math.min(text.length, Math.floor(cursor)));
    const math = findMarkdownMathAt(text, end, { includeOpen: true });
    if (!math || end < math.contentStart || end > math.contentEnd) return null;
    const prefix = text.slice(math.contentStart, end);
    const match = /(^|[^\\])\\([A-Za-z]*)$/.exec(prefix);
    if (!match) return null;
    const start = math.contentStart + (match.index ?? 0) + match[1].length;
    if (text[start - 1] === '\\') return null;
    return {
        start,
        end,
        query: match[2],
        math,
    };
}
