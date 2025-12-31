/**
 * Rule Engine - Manages and applies conversion rules
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 4: Conflict Detection Required
 */

import type { Rule, NodeFilter } from './Rule';

export class RuleEngine {
    private rules: Rule[] = [];
    private ruleCache = new WeakMap<Node, Rule | null>();

    /**
     * Add a rule to the engine
     * 
     * MANDATORY: Detects and throws on priority conflicts
     * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 4
     * 
     * @param rule - Rule to add
     * @throws Error if rule conflicts with existing rule
     */
    addRule(rule: Rule): this {
        // Check for conflicts (MANDATORY per DEVELOPER-REFERENCE-MANUAL)
        const existing = this.rules.find(r =>
            r.priority === rule.priority &&
            this.filtersOverlap(r.filter, rule.filter)
        );

        if (existing) {
            throw new Error(
                `Rule conflict: "${rule.name}" and "${existing.name}" ` +
                `both have priority ${rule.priority} with overlapping filters`
            );
        }

        this.rules.push(rule);

        // Sort by priority (lower number = higher priority)
        this.rules.sort((a, b) => a.priority - b.priority);

        return this;
    }

    /**
     * Find matching rule for a node
     * 
     * @param node - Node to match
     * @returns Matching rule or null
     */
    findRule(node: Node): Rule | null {
        // Check cache first
        if (this.ruleCache.has(node)) {
            return this.ruleCache.get(node)!;
        }

        // Find first matching rule (rules are sorted by priority)
        for (const rule of this.rules) {
            if (this.matchFilter(node, rule.filter)) {
                this.ruleCache.set(node, rule);
                return rule;
            }
        }

        // No rule matched
        this.ruleCache.set(node, null);
        return null;
    }

    /**
     * Check if node matches filter
     */
    private matchFilter(node: Node, filter: NodeFilter): boolean {
        if (typeof filter === 'string') {
            // CSS selector
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            return (node as Element).matches(filter);
        }

        if (Array.isArray(filter)) {
            // Tag name array
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            const tagName = (node as Element).tagName.toLowerCase();
            return filter.includes(tagName);
        }

        // Custom function
        return filter(node);
    }

    /**
     * Check if two filters overlap
     * (Simple implementation: only checks if both are same CSS selector)
     */
    private filtersOverlap(f1: NodeFilter, f2: NodeFilter): boolean {
        // If both are same CSS selector string, they overlap
        if (typeof f1 === 'string' && typeof f2 === 'string') {
            return f1 === f2;
        }

        // If both are arrays, check intersection
        if (Array.isArray(f1) && Array.isArray(f2)) {
            return f1.some(tag => f2.includes(tag));
        }

        // For functions, cannot reliably detect overlap
        return false;
    }

    /**
     * Get all registered rules (for debugging)
     */
    getRules(): readonly Rule[] {
        return this.rules;
    }

    /**
     * Clear all rules
     */
    clear(): void {
        this.rules = [];
        this.ruleCache = new WeakMap();
    }
}
