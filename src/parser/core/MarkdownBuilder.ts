/**
 * Markdown String Builder
 * 
 * Utility for efficiently building Markdown strings
 */

export class MarkdownBuilder {
    private parts: string[] = [];

    /**
     * Append Markdown content
     * @param markdown - Markdown string to append
     */
    append(markdown: string): this {
        if (markdown) {
            this.parts.push(markdown);
        }
        return this;
    }

    /**
     * Append with explicit newline
     * @param markdown - Markdown string
     * @param newlines - Number of newlines to add (default: 2)
     */
    appendLine(markdown: string, newlines: number = 2): this {
        if (markdown) {
            this.parts.push(markdown + '\n'.repeat(newlines));
        }
        return this;
    }

    /**
     * Get final Markdown string
     * @returns Complete Markdown document
     */
    toString(): string {
        return this.parts.join('');
    }

    /**
     * Clear builder
     */
    clear(): this {
        this.parts = [];
        return this;
    }

    /**
     * Get current length
     */
    get length(): number {
        return this.parts.reduce((sum, part) => sum + part.length, 0);
    }
}
