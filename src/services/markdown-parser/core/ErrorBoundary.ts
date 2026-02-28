export type RecoveryAction = 'skip' | 'fallback' | 'abort';

export class ParserError extends Error {
    public readonly node: Node;
    public readonly recoveryAction: RecoveryAction;
    public readonly context?: Record<string, unknown>;

    constructor(message: string, node: Node, recoveryAction: RecoveryAction, context?: Record<string, unknown>) {
        super(message);
        this.name = 'ParserError';
        this.node = node;
        this.recoveryAction = recoveryAction;
        this.context = context;

        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, ParserError);
        }
    }
}

import { logger } from '../../../core/logger';

export function withErrorBoundary<T>(fn: () => T, fallback: T, context: { node: Node; handlerName: string }): T {
    try {
        return fn();
    } catch (error) {
        logger.error(`[AI-MarkDone][${context.handlerName}] Failed for node`, {
            nodeType: context.node.nodeType,
            nodeName: context.node.nodeName,
            error: error instanceof Error ? error.message : String(error),
        });
        return fallback;
    }
}

export function checkMaxDepth(depth: number, maxDepth: number = 100): void {
    if (depth > maxDepth) {
        throw new ParserError(`Max recursion depth (${maxDepth}) exceeded`, document.createTextNode(''), 'abort', {
            depth,
            maxDepth,
        });
    }
}

