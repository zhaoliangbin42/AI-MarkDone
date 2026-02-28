import type { Rule } from '../../core/Rule';

export function createImageRule(): Rule {
    return {
        name: 'image',
        filter: ['img'],
        priority: 11,
        replacement: (_content, node) => {
            const el = node as HTMLImageElement;
            const alt = el.getAttribute('alt') || '';
            const src = el.getAttribute('src') || '';
            if (!src) return '';
            return `![${alt}](${src})`;
        },
    };
}

