type BoxSnapshot = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
    borderLeft: number;
    borderTop: number;
};

type SceneNodeKind = 'section' | 'assistant' | 'markdown' | 'block';

type SceneNode = {
    element: HTMLElement;
    parent: SceneNode | null;
    box: BoxSnapshot;
    kind: SceneNodeKind;
};

type SceneDivider = {
    left: number;
    top: number;
    width: number;
    height: number;
    color: string;
};

export type MessageBandSceneIndex = {
    source: HTMLElement;
    sourceTop: number;
    card: HTMLElement;
    cardBox: BoxSnapshot;
    nodes: readonly SceneNode[];
    blocks: readonly SceneNode[];
    dividers: readonly SceneDivider[];
};

export type ActiveMessageBandScene = {
    filter: (node: Node) => boolean;
    sourceTopCssPx: number;
    restore: () => void;
};

type StyleState = {
    element: HTMLElement;
    cssText: string;
};

function directChild(parent: HTMLElement, className: string): HTMLElement | null {
    return Array.from(parent.children).find((child): child is HTMLElement => (
        child instanceof HTMLElement && child.classList.contains(className)
    )) ?? null;
}

function snapshot(element: HTMLElement): BoxSnapshot | null {
    const rect = element.getBoundingClientRect();
    if (![rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite)
        || rect.width <= 0
        || rect.height <= 0) {
        return null;
    }
    const style = getComputedStyle(element);
    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        borderLeft: Number.parseFloat(style.borderLeftWidth) || 0,
        borderTop: Number.parseFloat(style.borderTopWidth) || 0,
    };
}

function hasUnsupportedProjectionStyle(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return Boolean((style.transform && style.transform !== 'none')
        || (style.filter && style.filter !== 'none')
        || (style.maskImage && style.maskImage !== 'none')
        || (style.clipPath && style.clipPath !== 'none'));
}

function addNode(
    nodes: SceneNode[],
    blocks: SceneNode[],
    element: HTMLElement,
    parent: SceneNode | null,
    kind: SceneNodeKind,
): SceneNode | null {
    const box = snapshot(element);
    if (!box) return null;
    const node = { element, parent, box, kind } satisfies SceneNode;
    nodes.push(node);
    if (kind === 'block') blocks.push(node);
    return node;
}

export function indexMessageBandScene(source: HTMLElement): MessageBandSceneIndex | null {
    const card = directChild(source, 'aimd-png-export-card');
    const sourceBox = snapshot(source);
    const cardBox = card ? snapshot(card) : null;
    if (!card
        || !sourceBox
        || !cardBox
        || Math.abs(cardBox.top - sourceBox.top) > 0.5
        || hasUnsupportedProjectionStyle(card)) return null;

    const nodes: SceneNode[] = [];
    const blocks: SceneNode[] = [];
    const dividers: SceneDivider[] = [];
    const sections = Array.from(card.children).filter((child): child is HTMLElement => (
        child instanceof HTMLElement && child.classList.contains('message-section')
    ));
    if (sections.length === 0) return null;

    for (const sectionElement of sections) {
        const section = addNode(nodes, blocks, sectionElement, null, 'section');
        if (!section || hasUnsupportedProjectionStyle(sectionElement)) return null;
        const sectionStyle = getComputedStyle(sectionElement);
        const dividerHeight = Number.parseFloat(sectionStyle.borderTopWidth) || 0;
        if (dividerHeight > 0 && sectionStyle.borderTopColor !== 'transparent') {
            dividers.push({
                left: section.box.left,
                top: section.box.top,
                width: section.box.width,
                height: dividerHeight,
                color: sectionStyle.borderTopColor,
            });
        }

        const header = directChild(sectionElement, 'message-header');
        const prompt = directChild(sectionElement, 'user-prompt');
        const assistantElement = directChild(sectionElement, 'assistant-response');
        if (!header || !prompt || !assistantElement) return null;
        if (!addNode(nodes, blocks, header, section, 'block')) return null;
        if (!addNode(nodes, blocks, prompt, section, 'block')) return null;

        const assistant = addNode(nodes, blocks, assistantElement, section, 'assistant');
        if (!assistant || hasUnsupportedProjectionStyle(assistantElement)) return null;
        const label = directChild(assistantElement, 'assistant-response-label');
        const markdownElement = directChild(assistantElement, 'reader-markdown');
        if (!label || !markdownElement) return null;
        if (!addNode(nodes, blocks, label, assistant, 'block')) return null;

        const markdown = addNode(nodes, blocks, markdownElement, assistant, 'markdown');
        if (!markdown || hasUnsupportedProjectionStyle(markdownElement)) return null;
        for (const child of Array.from(markdownElement.children)) {
            if (!(child instanceof HTMLElement)) continue;
            if (!addNode(nodes, blocks, child, markdown, 'block')) return null;
        }
    }

    return {
        source,
        sourceTop: sourceBox.top,
        card,
        cardBox,
        nodes,
        blocks,
        dividers,
    };
}

function intersectsBand(
    node: SceneNode,
    sourceTop: number,
    startCssPx: number,
    endCssPx: number,
    guardCssPx: number,
): boolean {
    const top = node.box.top - sourceTop;
    const bottom = node.box.bottom - sourceTop;
    return bottom > startCssPx - guardCssPx && top < endCssPx + guardCssPx;
}

function saveStyle(states: StyleState[], element: HTMLElement): void {
    states.push({ element, cssText: element.style.cssText });
}

function projectCard(
    index: MessageBandSceneIndex,
    states: StyleState[],
    bandHeightCssPx: number,
): void {
    saveStyle(states, index.card);
    index.card.style.position = 'relative';
    index.card.style.width = `${index.cardBox.width}px`;
    index.card.style.height = `${bandHeightCssPx}px`;
    index.card.style.minHeight = `${bandHeightCssPx}px`;
    index.card.style.boxSizing = 'border-box';
}

function projectNode(
    node: SceneNode,
    index: MessageBandSceneIndex,
    states: StyleState[],
    startCssPx: number,
    bandHeightCssPx: number,
): void {
    const parentBox = node.parent?.box ?? index.cardBox;
    const parentProjectedTop = node.parent ? index.sourceTop : index.cardBox.top;
    const projectedTop = node.kind === 'block'
        ? node.box.top - startCssPx
        : index.sourceTop;
    const projectedHeight = node.kind === 'block' ? node.box.height : bandHeightCssPx;
    saveStyle(states, node.element);
    node.element.style.position = 'absolute';
    node.element.style.left = `${node.box.left - parentBox.left - parentBox.borderLeft}px`;
    node.element.style.top = `${projectedTop - parentProjectedTop - parentBox.borderTop}px`;
    node.element.style.width = `${node.box.width}px`;
    node.element.style.height = `${projectedHeight}px`;
    node.element.style.minHeight = `${projectedHeight}px`;
    node.element.style.margin = '0';
    node.element.style.boxSizing = 'border-box';
    if (node.kind === 'section') node.element.style.borderTopColor = 'transparent';
}

function restoreStyles(states: readonly StyleState[]): void {
    for (let index = states.length - 1; index >= 0; index -= 1) {
        const state = states[index]!;
        state.element.style.cssText = state.cssText;
    }
}

function geometryMatches(
    node: SceneNode,
    index: MessageBandSceneIndex,
    startCssPx: number,
    bandHeightCssPx: number,
    toleranceCssPx: number,
): boolean {
    const rect = node.element.getBoundingClientRect();
    const expectedTop = node.kind === 'block' ? node.box.top - startCssPx : index.sourceTop;
    const expectedHeight = node.kind === 'block' ? node.box.height : bandHeightCssPx;
    return Math.abs(rect.left - node.box.left) <= toleranceCssPx
        && Math.abs(rect.top - expectedTop) <= toleranceCssPx
        && Math.abs(rect.width - node.box.width) <= toleranceCssPx
        && Math.abs(rect.height - expectedHeight) <= toleranceCssPx;
}

function isOversizedStructuredBlock(node: SceneNode, bandHeightCssPx: number): boolean {
    return node.box.height > bandHeightCssPx * 1.25
        && node.element.matches('table, ol, ul, pre, .reader-code-block');
}

export function activateMessageBandScene(
    index: MessageBandSceneIndex,
    startCssPx: number,
    endCssPx: number,
    pixelRatio: number,
): ActiveMessageBandScene | null {
    const bandHeightCssPx = endCssPx - startCssPx;
    if (!(bandHeightCssPx > 0) || !(pixelRatio > 0)) return null;
    const guardCssPx = 1 / pixelRatio;
    const included = new Set<SceneNode>();
    const excludedElements = new Set<HTMLElement>();

    for (const node of index.nodes) {
        if (intersectsBand(node, index.sourceTop, startCssPx, endCssPx, guardCssPx)) included.add(node);
        else excludedElements.add(node.element);
    }
    for (const block of index.blocks) {
        if (included.has(block) && isOversizedStructuredBlock(block, bandHeightCssPx)) return null;
    }

    const states: StyleState[] = [];
    projectCard(index, states, bandHeightCssPx);
    for (const node of index.nodes) {
        if (included.has(node)) projectNode(
            node,
            index,
            states,
            startCssPx,
            bandHeightCssPx,
        );
    }

    const toleranceCssPx = Math.max(0.5, guardCssPx);
    const geometryIsStable = index.nodes.every((node) => (
        !included.has(node) || geometryMatches(
            node,
            index,
            startCssPx,
            bandHeightCssPx,
            toleranceCssPx,
        )
    ));
    if (!geometryIsStable) {
        restoreStyles(states);
        return null;
    }

    const decorations: HTMLElement[] = [];
    for (const divider of index.dividers) {
        const relativeTop = divider.top - index.sourceTop;
        if (relativeTop + divider.height <= startCssPx - guardCssPx
            || relativeTop >= endCssPx + guardCssPx) continue;
        const decoration = document.createElement('div');
        decoration.dataset.aimdBandSceneDivider = 'true';
        decoration.style.position = 'absolute';
        decoration.style.left = `${divider.left - index.cardBox.left - index.cardBox.borderLeft}px`;
        decoration.style.top = `${divider.top - startCssPx - index.cardBox.top - index.cardBox.borderTop}px`;
        decoration.style.width = `${divider.width}px`;
        decoration.style.height = `${divider.height}px`;
        decoration.style.background = divider.color;
        decoration.style.pointerEvents = 'none';
        index.card.appendChild(decoration);
        decorations.push(decoration);
    }

    let restored = false;
    return {
        filter: (node) => !(node instanceof HTMLElement && excludedElements.has(node)),
        sourceTopCssPx: 0,
        restore: () => {
            if (restored) return;
            restored = true;
            for (const decoration of decorations) decoration.remove();
            restoreStyles(states);
        },
    };
}
