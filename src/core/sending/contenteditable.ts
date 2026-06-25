/**
 * Contenteditable serialization utilities.
 *
 * These are copied from legacy `MessageSender` semantics:
 * - Preserve exact newlines across ProseMirror-like structures.
 * - Apply plain text via safe node composition (no unsafe innerHTML).
 */

/**
 * Parse contenteditable HTML to plain text, preserving exact newlines.
 *
 * ProseMirror structure:
 * - Each <p> represents one line
 * - Empty lines are <p><br></p> (br is a placeholder, not an extra newline)
 */
export function parseContenteditableToPlainText(element: HTMLElement): string {
    const blocks = element.querySelectorAll('p, div');

    if (blocks.length > 0) {
        const lines: string[] = [];
        blocks.forEach((block) => {
            const text = block.textContent || '';
            lines.push(text);
        });
        return lines.join('\n');
    }

    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach((br) => {
        br.replaceWith('\n');
    });

    return clone.textContent || '';
}

/**
 * Apply plain text to contenteditable as ProseMirror-like block structure.
 */
export function applyPlainTextToContenteditable(input: HTMLElement, text: string): void {
    const lines = text.split('\n');
    const nodes: HTMLElement[] = lines.map((line) => {
        const p = document.createElement('p');
        if (line === '') {
            p.appendChild(document.createElement('br'));
        } else {
            p.textContent = line;
        }
        return p;
    });

    input.replaceChildren(...nodes);
}

function clampOffset(value: number, text: string): number {
    if (!Number.isFinite(value)) return text.length;
    return Math.max(0, Math.min(text.length, Math.floor(value)));
}

function getEditableBlocks(input: HTMLElement): HTMLElement[] {
    const directBlocks = Array.from(input.children).filter((child): child is HTMLElement => (
        child instanceof HTMLElement && (child.tagName === 'P' || child.tagName === 'DIV')
    ));
    if (directBlocks.length > 0) return directBlocks;
    return [input];
}

function findTextBoundary(root: HTMLElement, targetOffset: number): { node: Node; offset: number } {
    const blocks = getEditableBlocks(root);
    let remaining = clampOffset(targetOffset, parseContenteditableToPlainText(root));

    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index]!;
        const lineLength = block.textContent?.length ?? 0;
        if (remaining <= lineLength) return findTextBoundaryInBlock(block, remaining);
        remaining -= lineLength;
        if (index < blocks.length - 1) {
            remaining = Math.max(0, remaining - 1);
        }
    }

    const last = blocks[blocks.length - 1] ?? root;
    return findTextBoundaryInBlock(last, last.textContent?.length ?? 0);
}

function findTextBoundaryInBlock(block: HTMLElement, offset: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let lastText: Text | null = null;

    while (walker.nextNode()) {
        const text = walker.currentNode as Text;
        lastText = text;
        const length = text.data.length;
        if (remaining <= length) {
            return { node: text, offset: remaining };
        }
        remaining -= length;
    }

    if (lastText) return { node: lastText, offset: lastText.data.length };
    return { node: block, offset: 0 };
}

function containsSelectionBoundary(root: HTMLElement, node: Node): boolean {
    return node === root || root.contains(node);
}

function getPlainTextOffsetForBoundary(root: HTMLElement, node: Node, offset: number): number | null {
    if (!containsSelectionBoundary(root, node)) return null;
    try {
        const range = document.createRange();
        range.setStart(root, 0);
        range.setEnd(node, offset);
        const temp = document.createElement('div');
        temp.appendChild(range.cloneContents());
        return parseContenteditableToPlainText(temp).length;
    } catch {
        return null;
    }
}

function createDomRect(left: number, top: number, width: number, height: number): DOMRect {
    if (typeof DOMRect === 'function') return new DOMRect(left, top, width, height);
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
    } as DOMRect;
}

function isUsableRect(rect: DOMRect | null | undefined): rect is DOMRect {
    return Boolean(
        rect
        && Number.isFinite(rect.left)
        && Number.isFinite(rect.top)
        && Number.isFinite(rect.right)
        && Number.isFinite(rect.bottom)
        && (rect.width > 0 || rect.height > 0),
    );
}

function getRangeViewportRect(range: Range): DOMRect | null {
    const getClientRects = (range as Range & { getClientRects?: () => DOMRectList | DOMRect[] }).getClientRects;
    if (typeof getClientRects === 'function') {
        const rects = Array.from(getClientRects.call(range) as DOMRectList | DOMRect[]).filter(isUsableRect);
        const rect = rects[rects.length - 1];
        if (rect) return rect;
    }

    const getBoundingClientRect = (range as Range & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect;
    if (typeof getBoundingClientRect === 'function') {
        const rect = getBoundingClientRect.call(range);
        if (isUsableRect(rect)) return rect;
    }

    return null;
}

function getPreviousCharacterCaretRect(root: HTMLElement, range: Range): DOMRect | null {
    const caretOffset = getPlainTextOffsetForBoundary(root, range.startContainer, range.startOffset);
    if (caretOffset === null || caretOffset <= 0) return null;
    try {
        const previousRange = document.createRange();
        const start = findTextBoundary(root, caretOffset - 1);
        const end = findTextBoundary(root, caretOffset);
        previousRange.setStart(start.node, start.offset);
        previousRange.setEnd(end.node, end.offset);
        const previousRect = getRangeViewportRect(previousRange);
        if (!previousRect) return null;
        return createDomRect(previousRect.right, previousRect.top, 0, previousRect.height);
    } catch {
        return null;
    }
}

export function getContenteditablePlainTextSelection(input: HTMLElement): { start: number; end: number } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount < 1) return null;
    const range = selection.getRangeAt(0);
    const start = getPlainTextOffsetForBoundary(input, range.startContainer, range.startOffset);
    const end = getPlainTextOffsetForBoundary(input, range.endContainer, range.endOffset);
    if (start === null || end === null) return null;
    return { start, end };
}

export function getContenteditableCaretClientRect(input: HTMLElement): DOMRect | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount < 1 || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !containsSelectionBoundary(input, range.startContainer)) return null;

    const directRect = getRangeViewportRect(range.cloneRange());
    if (directRect) return directRect;

    return getPreviousCharacterCaretRect(input, range);
}

export function setContenteditablePlainTextSelection(input: HTMLElement, start: number, end: number = start): boolean {
    const selection = window.getSelection();
    if (!selection) return false;
    try {
        const range = document.createRange();
        const startBoundary = findTextBoundary(input, start);
        const endBoundary = findTextBoundary(input, end);
        range.setStart(startBoundary.node, startBoundary.offset);
        range.setEnd(endBoundary.node, endBoundary.offset);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    } catch {
        return false;
    }
}
