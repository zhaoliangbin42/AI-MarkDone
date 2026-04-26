import type { SelectedAtomicUnit } from './atomicSelection';

export function buildAtomicSelectionExport(params: {
    range: Range;
    root: HTMLElement;
    selectedUnits: SelectedAtomicUnit[];
}): string {
    const { range, root, selectedUnits } = params;
    if (selectedUnits.length < 1) return range.toString().trim();

    const selectedUnitMap = new Map(selectedUnits.map((unit) => [unit.element, unit]));
    const blockNames = new Set(['P', 'DIV', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

    const collectTextSlice = (textNode: Text): string => {
        if (!range.intersectsNode(textNode)) return '';
        if (!textNode.data.trim()) return '';
        let start = 0;
        let end = textNode.data.length;
        if (textNode === range.startContainer) start = range.startOffset;
        if (textNode === range.endContainer) end = range.endOffset;
        return textNode.data.slice(start, end);
    };

    const visit = (node: Node): string => {
        if (node instanceof HTMLElement) {
            const unit = selectedUnitMap.get(node);
            if (unit) return isBlockUnit(unit) ? `${unit.source}\n\n` : unit.source;

            const childParts: string[] = [];
            node.childNodes.forEach((child) => {
                const value = visit(child);
                if (value) childParts.push(value);
            });

            const joined = childParts.join('');
            if (joined && blockNames.has(node.tagName)) {
                return `${joined}\n\n`;
            }
            return joined;
        }

        if (node instanceof Text) {
            if (node.parentElement?.closest('[data-aimd-unit-id]')) return '';
            return collectTextSlice(node);
        }

        return '';
    };

    return visit(root).replace(/\n{3,}/g, '\n\n').trim();
}

function isBlockUnit(unit: SelectedAtomicUnit): boolean {
    return unit.mode === 'structural'
        || unit.kind === 'display-math'
        || unit.kind === 'code-block'
        || unit.kind === 'table'
        || unit.kind === 'image';
}
