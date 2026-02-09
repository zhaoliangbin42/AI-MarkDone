export interface ValidationResult {
    valid: boolean;
    sanitized: string;
    error?: string;
}

/**
 * Input validator for markdown content
 * Checks size, nesting depth, and dangerous patterns
 */
export class InputValidator {
    private static readonly MAX_NESTING_DEPTH = 50;
    private static readonly DANGEROUS_PATTERNS = [
        /javascript:/gi,
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /<iframe/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /onload\s*=/gi,
    ];

    private static readonly FENCED_CODE_BLOCK_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;

    /**
     * Validate markdown input
     */
    static validate(markdown: string, maxSize: number = 1_000_000): ValidationResult {
        // 1. Size check
        if (markdown.length > maxSize) {
            return {
                valid: false,
                error: 'CONTENT_TOO_LARGE',
                sanitized: markdown.slice(0, maxSize) + '\n\n[... 内容过长,已截断]',
            };
        }

        // 2. Nesting depth check (prevent stack overflow)
        const depth = this.calculateNestingDepth(markdown);
        if (depth > this.MAX_NESTING_DEPTH) {
            return {
                valid: false,
                error: 'NESTING_TOO_DEEP',
                sanitized: this.flattenMarkdown(markdown),
            };
        }

        // 3. Dangerous pattern check
        if (this.hasDangerousPatterns(markdown)) {
            return {
                valid: false,
                error: 'DANGEROUS_CONTENT',
                sanitized: this.removeDangerousPatterns(markdown),
            };
        }

        return { valid: true, sanitized: markdown };
    }

    /**
     * Calculate nesting depth of brackets/parentheses
     */
    private static calculateNestingDepth(markdown: string): number {
        let maxDepth = 0;
        let currentDepth = 0;

        for (const char of markdown) {
            if (char === '[' || char === '(') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === ']' || char === ')') {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }

        return maxDepth;
    }

    /**
     * Check for dangerous patterns
     */
    private static hasDangerousPatterns(markdown: string): boolean {
        const nonCodeMarkdown = this.stripFencedCodeBlocks(markdown);
        return this.DANGEROUS_PATTERNS.some(pattern => {
            // Global regexes are stateful with `.test()`. Reset to avoid false negatives across calls.
            pattern.lastIndex = 0;
            return pattern.test(nonCodeMarkdown);
        });
    }

    /**
     * Remove dangerous patterns
     */
    private static removeDangerousPatterns(markdown: string): string {
        return this.transformOutsideFencedCodeBlocks(markdown, (segment) => {
            let sanitized = segment;
            this.DANGEROUS_PATTERNS.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '');
            });
            return sanitized;
        });
    }

    /**
     * Flatten excessive nesting
     */
    private static flattenMarkdown(markdown: string): string {
        // Remove deeply nested links
        return markdown.replace(/\[([^\[\]]+)\]\([^\)]+\)/g, '$1');
    }

    /**
     * Remove fenced code blocks for security pattern scanning.
     * Why: code examples may legitimately contain strings such as `javascript:`.
     */
    private static stripFencedCodeBlocks(markdown: string): string {
        return markdown.replace(this.FENCED_CODE_BLOCK_PATTERN, '\n');
    }

    /**
     * Apply transform function only to non-code segments while preserving fenced blocks.
     */
    private static transformOutsideFencedCodeBlocks(
        markdown: string,
        transform: (segment: string) => string
    ): string {
        let result = '';
        let lastIndex = 0;
        const regex = new RegExp(this.FENCED_CODE_BLOCK_PATTERN.source, 'g');
        let match: RegExpExecArray | null;

        while ((match = regex.exec(markdown)) !== null) {
            const before = markdown.slice(lastIndex, match.index);
            result += transform(before);
            result += match[0];
            lastIndex = match.index + match[0].length;
        }

        result += transform(markdown.slice(lastIndex));
        return result;
    }
}
