import type { Rule } from '../../core/Rule';

export function createLineBreakRule(): Rule {
    return {
        name: 'line-break',
        filter: ['br'],
        priority: 12,
        replacement: () => {
            return '  \n';
        },
    };
}

