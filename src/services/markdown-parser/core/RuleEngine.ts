import type { MarkdownParserAdapter } from '../../../drivers/content/adapters/parser/MarkdownParserAdapter';
import type { Rule } from './Rule';

export class RuleEngine {
    private rules: Rule[] = [];

    addRule(rule: Rule): void {
        this.rules.push(rule);
        this.rules.sort((a, b) => a.priority - b.priority);
    }

    findRule(node: Node, adapter: MarkdownParserAdapter): Rule | null {
        for (const rule of this.rules) {
            if (matchesFilter(rule.filter, node, adapter)) {
                return rule;
            }
        }
        return null;
    }

    getRules(): Rule[] {
        return [...this.rules];
    }
}

function matchesFilter(filter: Rule['filter'], node: Node, adapter: MarkdownParserAdapter): boolean {
    if (Array.isArray(filter)) {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const elem = node as Element;
        return filter.includes(elem.tagName.toLowerCase());
    }
    return filter(node, adapter);
}
