import { logger } from '../../utils/logger';

/**
 * Table parser that converts HTML tables to Markdown pipe format
 */
export class TableParser {
  private placeholderMap: Map<string, string> = new Map();
  private placeholderCounter = 0;

  /**
   * Extract all tables from HTML and replace with placeholders
   */
  extract(html: string): string {
    this.placeholderMap.clear();
    this.placeholderCounter = 0;

    const tempDiv = parseHtmlToContainer(html);

    this.extractTables(tempDiv);

    return tempDiv.innerHTML;
  }

  /**
   * Restore placeholders with formatted tables
   */
  restore(markdown: string): string {
    let result = markdown;
    
    this.placeholderMap.forEach((table, placeholder) => {
      result = result.split(placeholder).join(table);
    });

    return result;
  }

  /**
   * Extract all <table> elements
   */
  private extractTables(container: HTMLElement): void {
    const tables = container.querySelectorAll('table');

    tables.forEach((table) => {
      const formatted = this.parseTable(table);
      if (!formatted) return;

      const placeholder = this.generatePlaceholder(formatted);

      const span = document.createElement('span');
      span.textContent = placeholder;
      table.replaceWith(span);

      logger.debug('[TableParser] Extracted table');
    });
  }

  /**
   * Parse table to Markdown format
   */
  private parseTable(table: HTMLTableElement): string | null {
    const rows: string[][] = [];

    // Extract headers from <thead>
    const thead = table.querySelector('thead');
    if (thead) {
      const headerRows = thead.querySelectorAll('tr');
      headerRows.forEach((tr) => {
        const cells = this.extractRowCells(tr);
        if (cells.length > 0) rows.push(cells);
      });
    }

    // Extract body from <tbody>
    const tbody = table.querySelector('tbody');
    if (tbody) {
      const bodyRows = tbody.querySelectorAll('tr');
      bodyRows.forEach((tr) => {
        const cells = this.extractRowCells(tr);
        if (cells.length > 0) rows.push(cells);
      });
    }

    // If no thead/tbody, try direct <tr> children
    if (rows.length === 0) {
      const directRows = table.querySelectorAll('tr');
      directRows.forEach((tr) => {
        const cells = this.extractRowCells(tr);
        if (cells.length > 0) rows.push(cells);
      });
    }

    if (rows.length === 0) return null;

    return this.formatTable(rows);
  }

  /**
   * Extract cells from a table row
   */
  private extractRowCells(tr: HTMLTableRowElement): string[] {
    const cells: string[] = [];
    
    // Get both <th> and <td>
    const cellElements = tr.querySelectorAll('th, td');
    
    cellElements.forEach((cell) => {
      // Get text content and clean it
      let text = cell.textContent || '';
      
      // Remove excessive whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      // Escape pipe characters in cell content
      text = text.replace(/\|/g, '\\|');
      
      cells.push(text);
    });

    return cells;
  }

  /**
   * Format rows as Markdown table
   */
  private formatTable(rows: string[][]): string {
    if (rows.length === 0) return '';

    // Determine column count from first row
    const colCount = rows[0].length;

    // Ensure all rows have same column count (pad if needed)
    const normalizedRows = rows.map((row) => {
      while (row.length < colCount) row.push('');
      return row.slice(0, colCount); // Truncate if too long
    });

    // Build Markdown table
    const lines: string[] = [];

    // Header row (first row)
    lines.push('| ' + normalizedRows[0].join(' | ') + ' |');

    // Separator row
    lines.push('| ' + Array(colCount).fill('---').join(' | ') + ' |');

    // Data rows
    for (let i = 1; i < normalizedRows.length; i++) {
      lines.push('| ' + normalizedRows[i].join(' | ') + ' |');
    }

    // Add blank lines before and after
    return '\n\n' + lines.join('\n') + '\n\n';
  }

  /**
   * Generate unique placeholder
   */
  private generatePlaceholder(formatted: string): string {
    const id = `{{TABLE-${this.placeholderCounter++}}}`;
    this.placeholderMap.set(id, formatted);
    return id;
  }

  /**
   * Get placeholder map for debugging
   */
  getPlaceholderMap(): Map<string, string> {
    return this.placeholderMap;
  }
}

function parseHtmlToContainer(html: string): HTMLDivElement {
  const parsed = new DOMParser().parseFromString(`<div id="aimd-table-root">${html}</div>`, 'text/html');
  const wrapper = parsed.getElementById('aimd-table-root');
  if (wrapper && wrapper instanceof HTMLDivElement) {
    return wrapper;
  }
  const fallback = document.createElement('div');
  fallback.textContent = html;
  return fallback;
}
