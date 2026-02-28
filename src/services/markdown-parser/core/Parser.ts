import { ParserError, checkMaxDepth, withErrorBoundary } from './ErrorBoundary';
import { RuleEngine } from './RuleEngine';
import type { ParserContext, ParserOptions } from './types';
import type { IPlatformAdapter } from '../adapters/IPlatformAdapter';
import type { RuleContext } from './Rule';
import { logger } from '../../../core/logger';

const DEFAULT_OPTIONS: Required<ParserOptions> = {
    maxProcessingTimeMs: 5000,
    maxNodeCount: 50000,
    enablePerformanceLogging: false,
    onError: (error, context) => {
        logger.error('[AI-MarkDone][Parser] Error', error, context);
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

    parse(element: HTMLElement): string {
        const startTime = performance.now();
        let nodeCount = 0;
        const warnings: string[] = [];
        const errors: Array<{ message: string; node?: Node }> = [];

        const checkBudget = () => {
            nodeCount++;
            if (nodeCount > this.options.maxNodeCount) {
                throw new ParserError(`Max nodes (${this.options.maxNodeCount}) exceeded`, element, 'abort', {
                    nodeCount,
                    maxNodeCount: this.options.maxNodeCount,
                });
            }
            const elapsed = performance.now() - startTime;
            if (elapsed > this.options.maxProcessingTimeMs) {
                throw new ParserError(`Time budget (${this.options.maxProcessingTimeMs}ms) exceeded`, element, 'abort', {
                    elapsed,
                    maxTime: this.options.maxProcessingTimeMs,
                });
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

            if (this.options.enablePerformanceLogging) {
                const elapsed = performance.now() - startTime;
                logger.debug(`[AI-MarkDone][Parser] Processed ${nodeCount} nodes in ${elapsed.toFixed(2)}ms`, {
                    platform: this.adapter.name,
                    warnings: warnings.length,
                    errors: errors.length,
                });
            }

            return markdown.replace(/\n{3,}/g, '\n\n').trim();
        } catch (error) {
            if (error instanceof ParserError && error.recoveryAction === 'abort') {
                logger.error('[AI-MarkDone][Parser] Parsing aborted', error.message);
                return `<!-- Parser ${error.message} -->\n\n${element.textContent || ''}`;
            }
            throw error;
        }
    }

    private processNode(node: Node, context: ParserContext, depth: number = 0): string {
        checkMaxDepth(depth, 100);
        context.checkBudget();

        return withErrorBoundary(() => this.processNodeUnsafe(node, context, depth), node.textContent || '', {
            node,
            handlerName: 'Parser.processNode',
        });
    }

    private processNodeUnsafe(node: Node, context: ParserContext, depth: number): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const rule = this.engine.findRule(node);
        if (rule) {
            const children = Array.from(node.childNodes || []);
            const childContent = children.map((child) => this.processNode(child, context, depth + 1)).join('');

            const ruleContext: RuleContext = {
                adapter: this.adapter,
                options: this.options,
                processChildren: (n: Node) => this.processNode(n, context, depth + 1),
                closest: (selector: string) => (node as Element).closest(selector),
                depth,
            };

            return withErrorBoundary(() => rule.replacement(childContent, node, ruleContext), childContent, {
                node,
                handlerName: rule.name,
            });
        }

        const children = Array.from(node.childNodes || []);
        return children.map((child) => this.processNode(child, context, depth + 1)).join('');
    }

    getRuleEngine(): RuleEngine {
        return this.engine;
    }

    getAdapter(): IPlatformAdapter {
        return this.adapter;
    }
}

