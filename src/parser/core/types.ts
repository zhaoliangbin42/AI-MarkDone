/**
 * Parser Options - Configuration for parser behavior
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 3: Performance Budgets MUST Be Enforced
 */

export interface ParserOptions {
    /**
     * Maximum processing time in milliseconds
     * @default 5000
     * @see DEVELOPER-REFERENCE-MANUAL.md - Performance Requirements
     */
    maxProcessingTimeMs?: number;

    /**
     * Maximum number of nodes to process
     * @default 50000
     * @see DEVELOPER-REFERENCE-MANUAL.md - Performance Requirements
     */
    maxNodeCount?: number;

    /**
     * Enable performance logging to console
     * @default false
     */
    enablePerformanceLogging?: boolean;

    /**
     * Custom error handler
     */
    onError?: (error: Error, context: Record<string, unknown>) => void;
}

/**
 * Default parser options
 */
export const DEFAULT_PARSER_OPTIONS: Required<ParserOptions> = {
    maxProcessingTimeMs: 5000,
    maxNodeCount: 50000,
    enablePerformanceLogging: false,
    onError: (error, context) => {
        logger.error('[Parser] Error:', error.message, context);
    },
};

/**
 * Parse metadata - Information about parsing process
 */
export interface ParseMetadata {
    /** Platform adapter name (e.g., 'ChatGPT', 'Gemini') */
    platform: string;

    /** Total number of nodes processed */
    nodeCount: number;

    /** Total processing time in milliseconds */
    processingTimeMs: number;

    /** Warnings collected during parsing */
    warnings: string[];

    /** Errors encountered (non-fatal) */
    errors: Array<{ message: string; node?: Node }>;
}

/**
 * Context passed through parsing process
 */
export interface ParserContext {
    /** Current options */
    options: Required<ParserOptions>;

    /** Current recursion depth */
    depth: number;

    /** Start time for performance tracking */
    startTime: number;

    /** Node counter */
    nodeCount: number;

    /** Warnings accumulator */
    warnings: string[];

    /** Errors accumulator */
    errors: Array<{ message: string; node?: Node }>;

    /**
     * Check performance budgets
     * @throws ParserError if budget exceeded
     */
    checkBudget: () => void;
}
import { logger } from '../../utils/logger';
