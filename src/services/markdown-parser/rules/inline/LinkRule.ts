import type { Rule } from '../../core/Rule';

export function createLinkRule(): Rule {
    return {
        name: 'link',
        filter: ['a'],
        priority: 11,
        replacement: (content, node) => {
            const el = node as HTMLAnchorElement;
            const href = el.getAttribute('href') || '';
            const text = content.trim() || href;
            if (!href) return text;
            return `[${text}](${href})`;
        },
    };
}

