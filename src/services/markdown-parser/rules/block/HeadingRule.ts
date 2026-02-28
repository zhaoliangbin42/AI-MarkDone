import type { Rule } from '../../core/Rule';

export function createHeadingRule(): Rule {
    return {
        name: 'heading',
        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const tag = (node as Element).tagName.toLowerCase();
            return /^h[1-6]$/.test(tag);
        },
        priority: 5,
        replacement: (content, node) => {
            const tag = (node as Element).tagName.toLowerCase();
            const level = Number(tag.slice(1));
            return `${'#'.repeat(level)} ${content.trim()}\n\n`;
        },
    };
}

