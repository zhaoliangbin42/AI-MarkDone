import type { CommentTemplateSegment, CommentTemplateTokenKey } from '../../../services/reader/commentExport';

type ReaderCommentTemplateEditorOptions = {
    root: HTMLElement;
    value: CommentTemplateSegment[];
    labels: Record<CommentTemplateTokenKey, string>;
    placeholder: string;
    onChange: (next: CommentTemplateSegment[]) => void;
};

const TOKEN_BOUNDARY = '\u200B';

function mergeTextSegments(segments: CommentTemplateSegment[]): CommentTemplateSegment[] {
    const normalized: CommentTemplateSegment[] = [];
    for (const segment of segments) {
        if (segment.type === 'text') {
            const last = normalized[normalized.length - 1];
            if (last?.type === 'text') {
                last.value += segment.value;
                continue;
            }
        }
        normalized.push(segment);
    }
    return normalized;
}

function segmentsEqual(left: CommentTemplateSegment[], right: CommentTemplateSegment[]): boolean {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
        const leftSegment = left[index];
        const rightSegment = right[index];
        if (leftSegment.type !== rightSegment.type) return false;
        if (leftSegment.type === 'text' && rightSegment.type === 'text') {
            if (leftSegment.value !== rightSegment.value) return false;
            continue;
        }
        if (leftSegment.type === 'token' && rightSegment.type === 'token') {
            if (leftSegment.key !== rightSegment.key) return false;
        }
    }
    return true;
}

function endsWithNewline(segments: CommentTemplateSegment[]): boolean {
    const last = segments[segments.length - 1];
    return last?.type === 'text' && last.value.endsWith('\n');
}

function isBlockElement(node: Node): node is HTMLElement {
    return node instanceof HTMLElement && ['DIV', 'P', 'LI'].includes(node.tagName);
}

function isTokenElement(node: Node | null): node is HTMLElement {
    return node instanceof HTMLElement && node.dataset.tokenKey != null;
}

function stripTokenBoundaries(value: string): string {
    return value.split(TOKEN_BOUNDARY).join('');
}

function nodeIsInside(root: HTMLElement, node: Node | null): boolean {
    return Boolean(node && (node === root || root.contains(node)));
}

function buildRangeFromStaticRange(root: HTMLElement, rangeLike: StaticRange): Range | null {
    if (!nodeIsInside(root, rangeLike.startContainer) || !nodeIsInside(root, rangeLike.endContainer)) {
        return null;
    }
    const range = document.createRange();
    range.setStart(rangeLike.startContainer, rangeLike.startOffset);
    range.setEnd(rangeLike.endContainer, rangeLike.endOffset);
    return range;
}

export class ReaderCommentTemplateEditor {
    private readonly root: HTMLElement;
    private readonly labels: Record<CommentTemplateTokenKey, string>;
    private readonly onChange: (next: CommentTemplateSegment[]) => void;
    private segments: CommentTemplateSegment[];
    private lastRange: Range | null = null;
    private shouldUseRememberedRange = false;

    constructor(options: ReaderCommentTemplateEditorOptions) {
        this.root = options.root;
        this.labels = options.labels;
        this.onChange = options.onChange;
        this.segments = mergeTextSegments(options.value);

        this.root.contentEditable = 'true';
        this.root.spellcheck = false;
        this.root.dataset.placeholder = options.placeholder;
        this.root.setAttribute('role', 'textbox');
        this.root.setAttribute('aria-multiline', 'true');
        this.render();
        this.installEvents();
    }

    update(value: CommentTemplateSegment[]): void {
        const nextSegments = mergeTextSegments(value);
        if (segmentsEqual(this.segments, nextSegments)) return;
        this.segments = nextSegments;
        this.render();
    }

    getValue(): CommentTemplateSegment[] {
        return mergeTextSegments(this.segments.map((segment) => ({ ...segment })));
    }

    rememberSelection(): void {
        this.captureSelection();
        this.shouldUseRememberedRange = Boolean(this.lastRange);
    }

    insertToken(key: CommentTemplateTokenKey): void {
        const range = this.getActiveRange();
        this.root.focus();
        const { trailingBoundary, fragment } = this.createTokenFragment(key);
        if (!range) {
            this.root.appendChild(fragment);
            this.placeCaretInText(trailingBoundary, trailingBoundary.data.length);
            this.syncFromDom();
            return;
        }

        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
        range.deleteContents();
        range.insertNode(fragment);
        this.placeCaretInText(trailingBoundary, trailingBoundary.data.length);
        this.syncFromDom();
    }

    private installEvents(): void {
        this.root.addEventListener('input', () => {
            this.captureSelection();
            this.syncFromDom();
        });

        this.root.addEventListener('keydown', (event) => {
            if (event.key === 'Backspace' || event.key === 'Delete') {
                if (this.deleteAdjacentToken(event.key === 'Backspace' ? 'backward' : 'forward')) {
                    event.preventDefault();
                    this.syncFromDom();
                }
            }
        });

        this.root.addEventListener('paste', (event) => {
            event.preventDefault();
            const text = event.clipboardData?.getData('text/plain') ?? '';
            this.insertTextAtSelection(text);
        });

        this.root.addEventListener('mouseup', () => this.captureSelection());
        this.root.addEventListener('keyup', () => this.captureSelection());
        this.root.addEventListener('focus', () => this.captureSelection());
    }

    private createChip(key: CommentTemplateTokenKey): HTMLElement {
        const chip = document.createElement('span');
        chip.className = 'reader-comment-template-editor__token';
        chip.contentEditable = 'false';
        chip.dataset.tokenKey = key;
        chip.textContent = this.labels[key];
        return chip;
    }

    private createTokenFragment(key: CommentTemplateTokenKey): {
        trailingBoundary: Text;
        fragment: DocumentFragment;
    } {
        const chip = this.createChip(key);
        const leadingBoundary = document.createTextNode(TOKEN_BOUNDARY);
        const trailingBoundary = document.createTextNode(TOKEN_BOUNDARY);
        const fragment = document.createDocumentFragment();
        fragment.append(leadingBoundary, chip, trailingBoundary);
        return { trailingBoundary, fragment };
    }

    private render(): void {
        this.root.replaceChildren();
        for (const segment of this.segments) {
            if (segment.type === 'text') {
                this.root.appendChild(document.createTextNode(segment.value));
                continue;
            }
            const { fragment } = this.createTokenFragment(segment.key);
            this.root.appendChild(fragment);
        }
        this.captureSelection();
    }

    private parseDom(): CommentTemplateSegment[] {
        const segments: CommentTemplateSegment[] = [];
        const visit = (node: Node): void => {
            if (node.nodeType === Node.TEXT_NODE) {
                const value = stripTokenBoundaries(node.textContent ?? '');
                if (value) segments.push({ type: 'text', value });
                return;
            }

            if (isTokenElement(node)) {
                segments.push({ type: 'token', key: node.dataset.tokenKey as CommentTemplateTokenKey });
                return;
            }

            if (node instanceof HTMLBRElement) {
                segments.push({ type: 'text', value: '\n' });
                return;
            }

            if (isBlockElement(node)) {
                if (segments.length > 0 && !endsWithNewline(segments)) {
                    segments.push({ type: 'text', value: '\n' });
                }
                node.childNodes.forEach(visit);
                if (node.nextSibling && !endsWithNewline(segments)) {
                    segments.push({ type: 'text', value: '\n' });
                }
                return;
            }

            node.childNodes.forEach(visit);
        };

        this.root.childNodes.forEach(visit);
        return mergeTextSegments(segments);
    }

    private syncFromDom(): void {
        this.segments = this.parseDom();
        this.onChange(this.getValue());
    }

    private captureSelection(): void {
        const range = this.readSelectionRange();
        if (!range) return;
        this.lastRange = range.cloneRange();
    }

    private getActiveRange(): Range | null {
        if (this.shouldUseRememberedRange && this.lastRange) {
            this.shouldUseRememberedRange = false;
            return this.lastRange.cloneRange();
        }
        const range = this.readSelectionRange();
        if (range) return range;
        return this.lastRange ? this.lastRange.cloneRange() : null;
    }

    private readSelectionRange(): Range | null {
        const selection = window.getSelection();
        if (!selection) return null;

        const rootNode = this.root.getRootNode();
        if (rootNode instanceof ShadowRoot && typeof selection.getComposedRanges === 'function') {
            const [composed] = selection.getComposedRanges({ shadowRoots: [rootNode] });
            if (composed) {
                return buildRangeFromStaticRange(this.root, composed);
            }
        }

        if (selection.rangeCount < 1) return null;
        const range = selection.getRangeAt(0);
        if (!nodeIsInside(this.root, range.commonAncestorContainer)) return null;
        return range;
    }

    private placeCaretInText(node: Text, offset: number): void {
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        this.lastRange = range.cloneRange();
    }

    private insertTextAtSelection(text: string): void {
        const range = this.getActiveRange();
        if (!range) {
            this.root.appendChild(document.createTextNode(text));
            this.syncFromDom();
            return;
        }

        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        const selection = window.getSelection();
        if (selection) {
            const nextRange = document.createRange();
            nextRange.setStart(textNode, text.length);
            nextRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(nextRange);
            this.lastRange = nextRange.cloneRange();
        }
        this.syncFromDom();
    }

    private deleteAdjacentToken(direction: 'backward' | 'forward'): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount < 1 || !selection.isCollapsed) return false;
        const range = selection.getRangeAt(0);
        if (!nodeIsInside(this.root, range.commonAncestorContainer)) return false;

        const token = this.findAdjacentToken(range, direction);
        if (!token) return false;

        const parent = token.parentNode;
        if (!parent) return false;
        const index = Array.prototype.indexOf.call(parent.childNodes, token);
        token.remove();

        const nextRange = document.createRange();
        if (parent === this.root) {
            const offset = direction === 'backward' ? Math.max(0, index - 1) : Math.min(index, parent.childNodes.length);
            nextRange.setStart(parent, offset);
        } else {
            nextRange.setStart(parent, Math.min(index, parent.childNodes.length));
        }
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
        this.lastRange = nextRange.cloneRange();
        return true;
    }

    private findAdjacentToken(range: Range, direction: 'backward' | 'forward'): HTMLElement | null {
        const { startContainer, startOffset } = range;

        if (startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = startContainer as Text;
            const beforeCaret = stripTokenBoundaries(textNode.data.slice(0, startOffset));
            const afterCaret = stripTokenBoundaries(textNode.data.slice(startOffset));
            if (direction === 'backward' && beforeCaret.length === 0) {
                return this.findSiblingToken(textNode.previousSibling, 'backward');
            }
            if (direction === 'forward' && afterCaret.length === 0) {
                return this.findSiblingToken(textNode.nextSibling, 'forward');
            }
            return null;
        }

        if (startContainer instanceof HTMLElement || startContainer instanceof DocumentFragment) {
            const childNodes = startContainer.childNodes;
            const adjacent = direction === 'backward'
                ? childNodes.item(startOffset - 1)
                : childNodes.item(startOffset);
            return this.findSiblingToken(adjacent, direction);
        }

        return null;
    }

    private findSiblingToken(node: Node | null, direction: 'backward' | 'forward'): HTMLElement | null {
        let current = node;
        while (current) {
            if (isTokenElement(current)) return current;
            if (current.nodeType === Node.TEXT_NODE && stripTokenBoundaries(current.textContent ?? '').length > 0) return null;
            current = direction === 'backward' ? current.previousSibling : current.nextSibling;
        }
        return null;
    }
}
