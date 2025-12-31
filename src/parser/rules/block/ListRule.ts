/**
 * List Rule - Convert <ul>/<ol> to Markdown lists with nesting
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Lists
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for lists (both ordered and unordered)
 * 
 * Priority: 6
 */
export function createListRule(): Rule {
    return {
        name: 'list',

        filter: ['ul', 'ol'],

        priority: 6,

        replacement: (_content, node, context) => {
            const listElem = node as HTMLElement;
            const isOrdered = listElem.tagName === 'OL';

            // Get all direct <li> children
            const items = Array.from(listElem.children).filter(
                child => child.tagName === 'LI'
            );

            // Determine indentation level
            const level = getListLevel(listElem);
            const indent = '  '.repeat(level);

            let result = '';
            items.forEach((item, index) => {
                const marker = isOrdered ? `${index + 1}.` : '-';
                const itemContent = processListItem(item as HTMLElement, context);

                result += `${indent}${marker} ${itemContent}\n`;
            });

            // Add extra newline if this is a top-level list
            if (level === 0) {
                result += '\n';
            }

            return result;
        },
    };
}

/**
 * Get list nesting level (0 = top-level)
 */
function getListLevel(listElem: HTMLElement): number {
    let level = 0;
    let parent = listElem.parentElement;

    while (parent) {
        if (parent.tagName === 'LI') {
            level++;
        }
        parent = parent.parentElement;
    }

    return level;
}

/**
 * Process list item content, handling nested lists
 */
function processListItem(li: HTMLElement, context: any): string {
    let content = '';

    // Process each child node
    for (const child of Array.from(li.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
            content += child.textContent || '';
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const elem = child as Element;

            // If it's a nested list, let the parser handle it recursively
            if (elem.tagName === 'UL' || elem.tagName === 'OL') {
                // Process nested list (will be handled by ListRule recursively)
                content += '\n' + context.processChildren(elem);
            } else {
                // Process other inline elements
                content += context.processChildren(elem);
            }
        }
    }

    return content.trim();
}
