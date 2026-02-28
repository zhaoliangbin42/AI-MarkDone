import { Parser } from './core/Parser';
import type { ParserOptions } from './core/types';
import type { IPlatformAdapter } from './adapters/IPlatformAdapter';
import { createMathBlockRule } from './rules/block/MathBlockRule';
import { createMathInlineRule } from './rules/inline/MathInlineRule';
import { createCodeBlockRule } from './rules/block/CodeBlockRule';
import { createTableRule } from './rules/block/TableRule';
import { createHeadingRule } from './rules/block/HeadingRule';
import { createListRule } from './rules/block/ListRule';
import { createBlockquoteRule } from './rules/block/BlockquoteRule';
import { createParagraphRule } from './rules/block/ParagraphRule';
import { createHorizontalRuleRule } from './rules/block/HorizontalRuleRule';
import { createStrongRule } from './rules/inline/StrongRule';
import { createEmphasisRule } from './rules/inline/EmphasisRule';
import { createCodeInlineRule } from './rules/inline/CodeInlineRule';
import { createLinkRule } from './rules/inline/LinkRule';
import { createImageRule } from './rules/inline/ImageRule';
import { createLineBreakRule } from './rules/inline/LineBreakRule';

export function createMarkdownParser(adapter: IPlatformAdapter, options: ParserOptions = {}): Parser {
    const parser = new Parser(adapter, {
        maxProcessingTimeMs: 5000,
        maxNodeCount: 50000,
        enablePerformanceLogging: false,
        ...options,
    });

    const engine = parser.getRuleEngine();

    engine.addRule(createMathBlockRule());
    engine.addRule(createMathInlineRule());
    engine.addRule(createCodeBlockRule());
    engine.addRule(createTableRule());

    engine.addRule(createHeadingRule());
    engine.addRule(createListRule());
    engine.addRule(createBlockquoteRule());

    engine.addRule(createStrongRule());
    engine.addRule(createEmphasisRule());
    engine.addRule(createCodeInlineRule());
    engine.addRule(createLinkRule());
    engine.addRule(createImageRule());
    engine.addRule(createHorizontalRuleRule());
    engine.addRule(createLineBreakRule());

    engine.addRule(createParagraphRule());

    return parser;
}

