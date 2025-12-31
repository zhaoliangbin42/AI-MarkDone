/**
 * Markdown Parser - Core parser implementation
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - All mandatory rules
 * @see implementation_plan.md - Phase 0-6 roadmap
 */

import { ParserError, withErrorBoundary, checkMaxDepth } from './ErrorBoundary';
import { RuleEngine } from './RuleEngine';
import type { ParserOptions, ParserContext } from './types';
import type { IPlatformAdapter } from '../adapters/IPlatformAdapter';
import type { RuleContext } from './Rule';

const DEFAULT_OPTIONS: Required<ParserOptions> = {
    maxProcessingTimeMs: 5000,
    maxNodeCount: 50000,
    enablePerformanceLogging: false,
    onError: (error, context) => {
        console.error('[Parser] Error:', error.message, context);
    },
};

export class Parser {
    private adapter: IPlatformAdapter;
    private engine: RuleEngine;
    private options: Required<ParserOptions>;

    constructor(adapter: IPlatformAdapter, options: ParserOptions = {}) {
        this.adapter = adapter;
        this.engine = new RuleEngine();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * Parse HTML element to Markdown
     * 
     * MANDATORY: Enforces error boundaries and performance budgets
     * @see DEVELOPER-REFERENCE-MANUAL.md - Rules 1, 3
     * 
     * @param element - HTML element to parse
     * @returns Markdown string
     */
    parse(element: HTMLElement): string {
        const startTime = performance.now();
        let nodeCount = 0;
        const warnings: string[] = [];
        const errors: Array<{ message: string; node?: Node }> = [];

        // Performance budget checker (DEVELOPER-REFERENCE-MANUAL Rule 3)
        const checkBudget = () => {
            nodeCount++;

            if (nodeCount > this.options.maxNodeCount) {
                throw new ParserError(
                    `Max nodes (${this.options.maxNodeCount}) exceeded`,
                    element,
                    'abort',
                    { nodeCount, maxNodeCount: this.options.maxNodeCount }
                );
            }

            const elapsed = performance.now() - startTime;
            if (elapsed > this.options.maxProcessingTimeMs) {
                throw new ParserError(
                    `Time budget (${this.options.maxProcessingTimeMs}ms) exceeded`,
                    element,
                    'abort',
                    { elapsed, maxTime: this.options.maxProcessingTimeMs }
                );
            }
        };

        const context: ParserContext = {
            options: this.options,
            depth: 0,
            startTime,
            nodeCount: 0,
            warnings,
            errors,
            checkBudget,
        };

        try {
            const markdown = this.processNode(element, context);

            // Performance logging
            if (this.options.enablePerformanceLogging) {
                const elapsed = performance.now() - startTime;
                console.log(
                    `[Parser] Processed ${nodeCount} nodes in ${elapsed.toFixed(2)}ms`,
                    {
                        platform: this.adapter.name,
                        warnings: warnings.length,
                        errors: errors.length,
                    }
                );
            }

            return markdown;

        } catch (error) {
            if (error instanceof ParserError && error.recoveryAction === 'abort') {
                // Graceful degradation: return raw text
                console.error('[Parser] Parsing aborted:', error.message);
                return `<!-- Parser ${error.message} -->\n\n${element.textContent || ''}`;
            }
            throw error;
        }
    }

    /**
     * Process a single node recursively
     * 
     * MANDATORY: Has error boundaries and depth guards
     * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 1
     * 
     * @param node - Node to process
     * @param context - Parser context
     * @param depth - Current recursion depth
     * @returns Markdown string
     */
    private processNode(
        node: Node,
        context: ParserContext,
        depth: number = 0
    ): string {
        // Guard: Stack overflow prevention (MANDATORY)
        checkMaxDepth(depth, 100);

        // Guard: Performance budget
        context.checkBudget();

        // Guard: Error boundary wrapper
        return withErrorBoundary(
            () => this.processNodeUnsafe(node, context, depth),
            node.textContent || '', // Fallback: raw text
            { node, handlerName: 'Parser.processNode' }
        );
    }

    /**
     * Process node without error boundary (internal)
     */
    private processNodeUnsafe(
        node: Node,
        context: ParserContext,
        depth: number
    ): string {
        // Text nodes: return as-is
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        // Non-element nodes: skip
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        // Find matching rule
        const rule = this.engine.findRule(node);

        if (rule) {
            // Process children first
            const children = Array.from(node.childNodes || []);
            const childContent = children
                .map(child => this.processNode(child, context, depth + 1))
                .join('');

            // Create rule context
            const ruleContext: RuleContext = {
                adapter: this.adapter,
                options: this.options,
                processChildren: (n: Node) => this.processNode(n, context, depth + 1),
                closest: (selector: string) => (node as Element).closest(selector),
                depth,
            };

            // Apply rule replacement (with error boundary)
            return withErrorBoundary(
                () => rule.replacement(childContent, node, ruleContext),
                childContent, // Fallback to child content
                { node, handlerName: rule.name }
            );
        }

        // No rule matched: recursively process children
        const children = Array.from(node.childNodes || []);
        return children
            .map(child => this.processNode(child, context, depth + 1))
            .join('');
    }

    /**
     * Get rule engine (for adding custom rules)
     */
    getRuleEngine(): RuleEngine {
        return this.engine;
    }

    /**
     * Get platform adapter
     */
    getAdapter(): IPlatformAdapter {
        return this.adapter;
    }
}
