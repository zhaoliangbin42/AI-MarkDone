import type { Rule } from '../../core/Rule';

export function createTableRule(): Rule {
    return {
        name: 'table',
        filter: ['table'],
        priority: 4,
        replacement: (_content, node) => {
            const table = node as HTMLTableElement;
            const rows = extractTableRows(table);
            if (rows.length === 0) return '';

            const hasHeader = detectHeader(table);
            const headerRow = hasHeader ? rows[0] : null;
            const dataRows = hasHeader ? rows.slice(1) : rows;
            const columnCount = rows[0].length;
            const alignments = detectAlignments(table, columnCount);

            let markdown = '';
            if (headerRow) {
                markdown += '| ' + headerRow.map((cell) => cell.trim()).join(' | ') + ' |\n';
            } else if (dataRows.length > 0) {
                markdown += '| ' + Array(columnCount).fill('').join(' | ') + ' |\n';
            }

            markdown +=
                '| ' +
                alignments
                    .map((align) => {
                        switch (align) {
                            case 'left':
                                return ':---';
                            case 'center':
                                return ':---:';
                            case 'right':
                                return '---:';
                            default:
                                return '---';
                        }
                    })
                    .join(' | ') +
                ' |\n';

            dataRows.forEach((row) => {
                while (row.length < columnCount) row.push('');
                markdown += '| ' + row.map((cell) => cell.trim()).join(' | ') + ' |\n';
            });

            return markdown + '\n';
        },
    };
}

function extractTableRows(table: HTMLTableElement): string[][] {
    const rows: string[][] = [];
    const allRows = table.querySelectorAll('tr');
    allRows.forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll('th, td').forEach((cell) => {
            let cellText = cell.textContent?.trim() || '';
            cellText = cellText.replace(/\|/g, '\\|');
            cellText = cellText.replace(/\n/g, ' ');
            cells.push(cellText);
        });
        if (cells.length > 0) rows.push(cells);
    });
    return rows;
}

function detectHeader(table: HTMLTableElement): boolean {
    if (table.querySelector('thead')) return true;
    const firstRow = table.querySelector('tr');
    return Boolean(firstRow && firstRow.querySelector('th'));
}

function detectAlignments(
    table: HTMLTableElement,
    columnCount: number
): Array<'left' | 'center' | 'right' | 'default'> {
    const firstRow = table.querySelector('tr');
    if (!firstRow) return Array(columnCount).fill('default');
    const cells = firstRow.querySelectorAll('th, td');
    const alignments: Array<'left' | 'center' | 'right' | 'default'> = [];
    for (let i = 0; i < columnCount; i++) {
        if (i < cells.length) alignments.push(detectCellAlignment(cells[i] as HTMLElement));
        else alignments.push('default');
    }
    return alignments;
}

function detectCellAlignment(cell: HTMLElement): 'left' | 'center' | 'right' | 'default' {
    const textAlign = cell.style.textAlign;
    if (textAlign === 'center') return 'center';
    if (textAlign === 'right') return 'right';
    if (textAlign === 'left') return 'left';

    const computedStyle = window.getComputedStyle(cell);
    const computedAlign = computedStyle.textAlign;
    if (computedAlign === 'center') return 'center';
    if (computedAlign === 'right') return 'right';

    const alignAttr = cell.getAttribute('align');
    if (alignAttr === 'center') return 'center';
    if (alignAttr === 'right') return 'right';
    if (alignAttr === 'left') return 'left';

    return 'default';
}

