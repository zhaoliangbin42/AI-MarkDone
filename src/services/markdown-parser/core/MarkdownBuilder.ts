export class MarkdownBuilder {
    private parts: string[] = [];

    append(markdown: string): this {
        if (markdown) this.parts.push(markdown);
        return this;
    }

    appendLine(markdown: string, newlines: number = 2): this {
        if (markdown) this.parts.push(markdown + '\n'.repeat(newlines));
        return this;
    }

    toString(): string {
        return this.parts.join('');
    }

    clear(): this {
        this.parts = [];
        return this;
    }

    get length(): number {
        return this.parts.reduce((sum, part) => sum + part.length, 0);
    }
}

