import type { Rule } from '../../core/Rule';

export function createHorizontalRuleRule(): Rule {
    return {
        name: 'horizontal-rule',
        filter: ['hr'],
        priority: 11,
        replacement: () => {
            return '\n---\n\n';
        },
    };
}
