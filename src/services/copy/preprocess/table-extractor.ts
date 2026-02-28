/**
 * Extract HTML tables into placeholders so HTML→Markdown conversion can stay simple and consistent.
 */
export class TableExtractor {
    private placeholderMap: Map<string, string> = new Map();
    private placeholderCounter = 0;

    extract(html: string): string {
        this.placeholderMap.clear();
        this.placeholderCounter = 0;

        const tempDiv = parseHtmlToContainer(html, 'aimd-table-extract-root');
        this.extractTables(tempDiv);
        return tempDiv.innerHTML;
    }

    restore(markdown: string): string {
        let result = markdown;
        this.placeholderMap.forEach((table, placeholder) => {
            result = result.split(placeholder).join(table);
        });
        return result;
    }

    private extractTables(container: HTMLElement): void {
        const tables = container.querySelectorAll('table');
        tables.forEach((table) => {
            const formatted = this.parseTable(table as HTMLTableElement);
            if (!formatted) return;
            const placeholder = this.generatePlaceholder(formatted);
            const span = document.createElement('span');
            span.textContent = placeholder;
            table.replaceWith(span);
        });
    }

    private parseTable(table: HTMLTableElement): string | null {
        const rows: string[][] = [];

        const allRows = table.querySelectorAll('tr');
        allRows.forEach((tr) => {
            const cells: string[] = [];
            tr.querySelectorAll('th, td').forEach((cell) => {
                let text = cell.textContent || '';
                text = text.replace(/\s+/g, ' ').trim();
                text = text.replace(/\|/g, '\\|');
                cells.push(text);
            });
            if (cells.length > 0) rows.push(cells);
        });

        if (rows.length === 0) return null;

        const colCount = rows[0].length;
        const normalizedRows = rows.map((row) => {
            const copy = row.slice(0, colCount);
            while (copy.length < colCount) copy.push('');
            return copy;
        });

        const lines: string[] = [];
        lines.push('| ' + normalizedRows[0].join(' | ') + ' |');
        lines.push('| ' + Array(colCount).fill('---').join(' | ') + ' |');
        for (let i = 1; i < normalizedRows.length; i++) {
            lines.push('| ' + normalizedRows[i].join(' | ') + ' |');
        }

        return '\n\n' + lines.join('\n') + '\n\n';
    }

    private generatePlaceholder(formatted: string): string {
        const id = `{{TABLE-${this.placeholderCounter++}}}`;
        this.placeholderMap.set(id, formatted);
        return id;
    }
}

function parseHtmlToContainer(html: string, rootId: string): HTMLDivElement {
    const parsed = new DOMParser().parseFromString(`<div id="${rootId}">${html}</div>`, 'text/html');
    const wrapper = parsed.getElementById(rootId);
    if (wrapper && wrapper instanceof HTMLDivElement) return wrapper;
    const fallback = document.createElement('div');
    fallback.textContent = html;
    return fallback;
}

