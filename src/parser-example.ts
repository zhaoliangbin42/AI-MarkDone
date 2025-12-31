/**
 * Parser Usage Example
 * 
 * Demonstrates how to use the new v3 parser
 */

import { Parser } from './parser/core/Parser';
import { ChatGPTAdapter } from './parser/adapters/ChatGPTAdapter';
import { createMathBlockRule } from './parser/rules/block/MathBlockRule';
import { createMathInlineRule } from './parser/rules/inline/MathInlineRule';
import { createCodeBlockRule } from './parser/rules/block/CodeBlockRule';
import { createHeadingRule } from './parser/rules/block/HeadingRule';
import { createListRule } from './parser/rules/block/ListRule';
import { createBlockquoteRule } from './parser/rules/block/BlockquoteRule';
import { createParagraphRule } from './parser/rules/block/ParagraphRule';
import { createHorizontalRuleRule } from './parser/rules/block/HorizontalRuleRule';
import { createStrongRule } from './parser/rules/inline/StrongRule';
import { createEmphasisRule } from './parser/rules/inline/EmphasisRule';
import { createCodeInlineRule } from './parser/rules/inline/CodeInlineRule';
import { createLinkRule } from './parser/rules/inline/LinkRule';
import { createImageRule } from './parser/rules/inline/ImageRule';
import { createLineBreakRule } from './parser/rules/inline/LineBreakRule';

/**
 * Initialize parser with ChatGPT adapter and register rules
 */
export function createMarkdownParser(options = {}) {
    // Create parser with ChatGPT adapter
    const parser = new Parser(new ChatGPTAdapter(), {
        maxProcessingTimeMs: 5000,
        maxNodeCount: 50000,
        enablePerformanceLogging: false,
        ...options,
    });

    // Register rules (in priority order)
    const engine = parser.getRuleEngine();

    // Priority 1-3: Math & Code blocks (highest)
    engine.addRule(createMathBlockRule());
    engine.addRule(createMathInlineRule());
    engine.addRule(createCodeBlockRule());

    // Priority 5-6: Block structure
    engine.addRule(createHeadingRule());
    engine.addRule(createListRule());
    engine.addRule(createBlockquoteRule());

    // Priority 7-12: Inline formatting
    engine.addRule(createStrongRule());
    engine.addRule(createEmphasisRule());
    engine.addRule(createCodeInlineRule());
    engine.addRule(createLinkRule());
    engine.addRule(createImageRule());
    engine.addRule(createHorizontalRuleRule());
    engine.addRule(createLineBreakRule());

    // Priority 10: Paragraphs
    engine.addRule(createParagraphRule());

    return parser;
}

/**
 * Parse HTML to Markdown
 * 
 * @example
 * const html = '<h1>Title</h1><p>Hello <strong>world</strong>!</p>';
 * const markdown = parseToMarkdown(html);
 * // Returns: "# Title\n\nHello **world**!\n\n"
 */
export function parseToMarkdown(html: string): string {
    const parser = createMarkdownParser();

    // Create DOM element from HTML string
    const temp = document.createElement('div');
    temp.innerHTML = html;

    return parser.parse(temp);
}
