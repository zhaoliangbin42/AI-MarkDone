import type { IPlatformAdapter } from '../adapters/IPlatformAdapter';
import type { ParserOptions } from './types';

export type RuleFilter = string[] | ((node: Node) => boolean);

export type RuleContext = {
    adapter: IPlatformAdapter;
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

