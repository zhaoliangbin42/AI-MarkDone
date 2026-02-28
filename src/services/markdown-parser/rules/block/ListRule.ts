import type { Rule } from '../../core/Rule';

export function createListRule(): Rule {
    return {
        name: 'list',
        filter: ['ul', 'ol'],
        priority: 6,
        replacement: (_content, node, context) => {
            const listElem = node as HTMLElement;
            const isOrdered = listElem.tagName === 'OL';
            const items = Array.from(listElem.children).filter((child) => child.tagName === 'LI');
            const level = getListLevel(listElem);
            const indent = '  '.repeat(level);

            let result = '';
            items.forEach((item, index) => {
                const marker = isOrdered ? `${index + 1}.` : '-';
                const itemContent = processListItem(item as HTMLElement, context);
                result += `${indent}${marker} ${itemContent}\n`;
            });

            if (level === 0) result += '\n';
            return result;
        },
    };
}

function getListLevel(listElem: HTMLElement): number {
    let level = 0;
    let parent = listElem.parentElement;
    while (parent) {
        if (parent.tagName === 'LI') level++;
        parent = parent.parentElement;
    }
    return level;
}

function processListItem(li: HTMLElement, context: any): string {
    let content = '';
    for (const child of Array.from(li.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) content += child.textContent || '';
        else if (child.nodeType === Node.ELEMENT_NODE) {
            const elem = child as Element;
            if (elem.tagName === 'UL' || elem.tagName === 'OL') content += '\n' + context.processChildren(elem);
            else content += context.processChildren(elem);
        }
    }
    return content.trim();
}

