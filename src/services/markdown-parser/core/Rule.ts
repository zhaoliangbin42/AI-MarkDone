import type { MarkdownParserAdapter } from '../../../drivers/content/adapters/parser/MarkdownParserAdapter';
import type { ParserOptions } from './types';

export type RuleFilter = string[] | ((node: Node, adapter: MarkdownParserAdapter) => boolean);

export type RuleContext = {
    adapter: MarkdownParserAdapter;
    options: Required<ParserOptions>;
    processChildren: (node: Node) => string;
    closest: (selector: string) => Element | null;
    depth: number;
};

export type Rule = {
    name: string;
    filter: RuleFilter;
    priority: number;
    replacement: (content: string, node: Node, context: RuleContext) => string;
};
