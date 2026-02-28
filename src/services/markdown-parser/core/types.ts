export type ParserOptions = {
    maxProcessingTimeMs?: number;
    maxNodeCount?: number;
    enablePerformanceLogging?: boolean;
    onError?: (error: Error, context: Record<string, unknown>) => void;
};

export type ParserContext = {
    options: Required<ParserOptions>;
    depth: number;
    startTime: number;
    nodeCount: number;
    warnings: string[];
    errors: Array<{ message: string; node?: Node }>;
    checkBudget: () => void;
};

