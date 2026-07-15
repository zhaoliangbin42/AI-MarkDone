import type { ExportDocumentV1 } from '../../../src/services/export/imageExportContracts';

export function createImageExportStressDocument(): ExportDocumentV1 {
    const code = Array.from({ length: 1_000 }, (_value, index) => (
        `const line_${String(index + 1).padStart(4, '0')} = "中文-${index + 1}-🧭";`
    )).join('\n');
    const columns = Array.from({ length: 12 }, (_value, index) => `Column ${index + 1}`);
    const table = [
        `| ${columns.join(' | ')} |`,
        `| ${columns.map(() => '---').join(' | ')} |`,
        ...Array.from({ length: 24 }, (_value, row) => (
            `| ${columns.map((_column, column) => `R${row + 1}C${column + 1}-long-cell-value`).join(' | ')} |`
        )),
    ].join('\n');
    const formulas = Array.from({ length: 300 }, (_value, index) => (
        `$x_{${index + 1}}^2 + y_{${index + 1}}^2 = z_{${index + 1}}^2$`
    )).join('\n\n');

    return {
        schemaVersion: 1,
        profile: 'message-card-v1',
        title: 'Deterministic image export stress corpus',
        labels: { user: 'You', assistant: 'Assistant' },
        sections: [{
            sourceIndex: 0,
            heading: 'Message 1',
            userText: 'Render the fixed stress corpus with RTL مرحبا and a long URL.',
            assistantMarkdown: [
                '# Stress corpus',
                '',
                'CJK underbrace: $\\underbrace{a+b}_{中文}$ and broken image ![broken](/broken-image.png).',
                '',
                'https://example.invalid/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/no-break',
                '',
                table,
                '',
                '```ts',
                code,
                '```',
                '',
                formulas,
            ].join('\n'),
        }],
    };
}
