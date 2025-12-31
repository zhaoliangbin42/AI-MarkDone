/**
 * Table Rule - Convert HTML tables to GFM Markdown tables
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Tables
 */

import type { Rule } from '../../core/Rule';

/**
 * Creates rule for HTML tables
 * 
 * Priority: 4 (High - after math/code, before most structures)
 */
export function createTableRule(): Rule {
    return {
        name: 'table',

        filter: ['table'],

        priority: 4,

        replacement: (_content, node, _context) => {
            const table = node as HTMLTableElement;

            // Extract table structure
            const rows = extractTableRows(table);

            if (rows.length === 0) {
                return ''; // Empty table
            }

            // Detect if first row is header
            const hasHeader = detectHeader(table);
            const headerRow = hasHeader ? rows[0] : null;
            const dataRows = hasHeader ? rows.slice(1) : rows;

            // Get column count from first row
            const columnCount = rows[0].length;

            // Detect alignment for each column
            const alignments = detectAlignments(table, columnCount);

            // Build Markdown table
            let markdown = '';

            // Header row (use first data row as header if no <thead>)
            if (headerRow) {
                markdown += '| ' + headerRow.map(cell => cell.trim()).join(' | ') + ' |\n';
            } else if (dataRows.length > 0) {
                // No header, create empty header
                markdown += '| ' + Array(columnCount).fill('').join(' | ') + ' |\n';
            }

            // Separator row with alignment markers
            markdown += '| ' + alignments.map(align => {
                switch (align) {
                    case 'left': return ':---';
                    case 'center': return ':---:';
                    case 'right': return '---:';
                    default: return '---';
                }
            }).join(' | ') + ' |\n';

            // Data rows
            const rowsToRender = hasHeader ? dataRows : dataRows;
            rowsToRender.forEach(row => {
                // Pad row if it has fewer cells than columns
                while (row.length < columnCount) {
                    row.push('');
                }
                markdown += '| ' + row.map(cell => cell.trim()).join(' | ') + ' |\n';
            });

            return markdown + '\n';
        },
    };
}

/**
 * Extract all table rows as 2D array of cell contents
 */
function extractTableRows(table: HTMLTableElement): string[][] {
    const rows: string[][] = [];

    // Process all rows in table
    const allRows = table.querySelectorAll('tr');

    allRows.forEach(tr => {
        const cells: string[] = [];
        const cellElements = tr.querySelectorAll('th, td');

        cellElements.forEach(cell => {
            // Get cell text content (plain text, no HTML)
            let cellText = cell.textContent?.trim() || '';

            // Handle special characters that break Markdown tables
            cellText = cellText.replace(/\|/g, '\\|'); // Escape pipes
            cellText = cellText.replace(/\n/g, ' '); // Single line only

            cells.push(cellText);
        });

        if (cells.length > 0) {
            rows.push(cells);
        }
    });

    return rows;
}

/**
 * Detect if table has a header row (checks for <thead> or first row with <th>)
 */
function detectHeader(table: HTMLTableElement): boolean {
    // Check for <thead> element
    if (table.querySelector('thead')) {
        return true;
    }

    // Check if first row has <th> elements
    const firstRow = table.querySelector('tr');
    if (firstRow && firstRow.querySelector('th')) {
        return true;
    }

    return false;
}

/**
 * Detect column alignment from CSS styles or <th>/<td> align attribute
 */
function detectAlignments(
    table: HTMLTableElement,
    columnCount: number
): Array<'left' | 'center' | 'right' | 'default'> {
    const alignments: Array<'left' | 'center' | 'right' | 'default'> = [];

    // Try to detect from first row
    const firstRow = table.querySelector('tr');
    if (!firstRow) {
        return Array(columnCount).fill('default');
    }

    const cells = firstRow.querySelectorAll('th, td');

    for (let i = 0; i < columnCount; i++) {
        if (i < cells.length) {
            const cell = cells[i] as HTMLElement;
            const alignment = detectCellAlignment(cell);
            alignments.push(alignment);
        } else {
            alignments.push('default');
        }
    }

    return alignments;
}

/**
 * Detect alignment for a single cell
 */
function detectCellAlignment(
    cell: HTMLElement
): 'left' | 'center' | 'right' | 'default' {
    // Check inline style
    const textAlign = cell.style.textAlign;
    if (textAlign === 'center') return 'center';
    if (textAlign === 'right') return 'right';
    if (textAlign === 'left') return 'left';

    // Check computed style
    const computedStyle = window.getComputedStyle(cell);
    const computedAlign = computedStyle.textAlign;
    if (computedAlign === 'center') return 'center';
    if (computedAlign === 'right') return 'right';

    // Check align attribute (deprecated but still used)
    const alignAttr = cell.getAttribute('align');
    if (alignAttr === 'center') return 'center';
    if (alignAttr === 'right') return 'right';
    if (alignAttr === 'left') return 'left';

    return 'default';
}
