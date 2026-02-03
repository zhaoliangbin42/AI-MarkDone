/**
 * Parser Error - Custom error class for parsing failures
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 1: All Node Processing MUST Have Error Boundaries
 */

export type RecoveryAction = 'skip' | 'fallback' | 'abort';

export class ParserError extends Error {
    public readonly node: Node;
    public readonly recoveryAction: RecoveryAction;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        node: Node,
        recoveryAction: RecoveryAction,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ParserError';
        this.node = node;
        this.recoveryAction = recoveryAction;
        this.context = context;

        // Capture stack trace (V8 specific, optional)
        if ((Error as any).captureStackTrace) {
            (Error as any).captureStackTrace(this, ParserError);
        }
    }
}

/**
 * Error boundary utility - Wraps function execution with error handling
 * 
 * @template T - Return type of the wrapped function
 * @param fn - Function to execute
 * @param fallback - Value to return if function throws
 * @param context - Context information for debugging
 * @returns Result of fn or fallback on error
 * 
 * @example
 * const result = withErrorBoundary(
 *   () => rule.replacement(content, node, context),
 *   '', // fallback to empty string
 *   { node, handlerName: 'MathRule' }
 * );
 */
export function withErrorBoundary<T>(
    fn: () => T,
    fallback: T,
    context: { node: Node; handlerName: string }
): T {
    try {
        return fn();
    } catch (error) {
        console.error(
            `[${context.handlerName}] Failed for node`,
            {
                nodeType: context.node.nodeType,
                nodeName: context.node.nodeName,
                error: error instanceof Error ? error.message : String(error),
            }
        );
        return fallback;
    }
}

/**
 * Guard against stack overflow from deeply nested HTML
 * 
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum allowed depth (default: 100)
 * @throws ParserError if max depth exceeded
 */
export function checkMaxDepth(depth: number, maxDepth: number = 100): void {
    if (depth > maxDepth) {
        throw new ParserError(
            `Max recursion depth (${maxDepth}) exceeded`,
            document.createTextNode(''), // Placeholder node
            'abort',
            { depth, maxDepth }
        );
    }
}
