/**
 * Rule Interface - Defines how HTML nodes are converted to Markdown
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 4: All Rules MUST Declare Priority
 * @see Syntax-Mapping-Spec.md - HTML → Markdown Conversion Rules
 */

import type { IPlatformAdapter } from '../adapters/IPlatformAdapter';
import type { ParserOptions } from './types';

/**
 * Node filter - Determines if rule applies to a node
 */
export type NodeFilter =
    | string                          // CSS selector: '.katex'
    | string[]                        // Tag names: ['h1', 'h2', 'h3']
    | ((node: Node) => boolean);      // Custom function

/**
 * Replacement function - Converts node to Markdown
 */
export type ReplacementFunction = (
    content: string,                  // Child nodes' Markdown
    node: Node,                       // Current node
    context: RuleContext              // Processing context
) => string;

/**
 * Rule context - Information passed to replacement functions
 */
export interface RuleContext {
    /** Platform adapter */
    adapter: IPlatformAdapter;

    /** Parser options */
    options: Required<ParserOptions>;

    /** Recursively process child nodes */
    processChildren(node: Node): string;

    /** Find closest ancestor matching selector */
    closest(selector: string): Element | null;

    /** Current depth in DOM tree */
    depth: number;
}

/**
 * Rule definition
 * 
 * MANDATORY: All rules MUST declare explicit priority
 * @see DEVELOPER-REFERENCE-MANUAL.md - Rule 4
 */
export interface Rule {
    /** Rule name (for debugging and conflict detection) */
    readonly name: string;

    /** Filter to match nodes */
    filter: NodeFilter;

    /** Function to convert node to Markdown */
    replacement: ReplacementFunction;

    /** 
     * Priority (lower = higher priority)
     * 
     * Standard priorities:
     * - 1: Math (highest)
     * - 2: Code blocks
     * - 3-5: Block elements (headings, tables, lists)
     * - 6-10: Inline elements
     * 
     * MANDATORY per DEVELOPER-REFERENCE-MANUAL Rule 4
     */
    priority: number;
}
