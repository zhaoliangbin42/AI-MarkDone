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
        return this.DANGEROUS_PATTERNS.some(pattern => pattern.test(markdown));
    }

    /**
     * Remove dangerous patterns
     */
    private static removeDangerousPatterns(markdown: string): string {
        let sanitized = markdown;

        this.DANGEROUS_PATTERNS.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        return sanitized;
    }

    /**
     * Flatten excessive nesting
     */
    private static flattenMarkdown(markdown: string): string {
        // Remove deeply nested links
        return markdown.replace(/\[([^\[\]]+)\]\([^\)]+\)/g, '$1');
    }
}
