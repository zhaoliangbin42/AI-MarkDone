import { describe, expect, it } from 'vitest';

import { buildAtomicSelectionExport } from '@/services/reader/atomicExport';

describe('atomicExport', () => {
    it('replaces intersected atomic units with their markdown source', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <p>Before <span data-aimd-unit-id="u1">code</span> and <span data-aimd-unit-id="u2">math</span> after</p>
          </div>
        `;

        const paragraph = root.querySelector('p')!;
        const firstText = paragraph.firstChild as Text;
        const lastText = paragraph.lastChild as Text;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(lastText, lastText.textContent!.length);

        const exportText = buildAtomicSelectionExport({
            range,
            root,
            selectedUnits: [
                {
                    id: 'u1',
                    kind: 'inline-code',
                    source: '`code`',
                    start: 7,
                    end: 13,
                    element: paragraph.querySelector('[data-aimd-unit-id="u1"]') as HTMLElement,
                },
                {
                    id: 'u2',
                    kind: 'inline-math',
                    source: '$x+y$',
                    start: 18,
                    end: 23,
                    element: paragraph.querySelector('[data-aimd-unit-id="u2"]') as HTMLElement,
                },
            ],
        });

        expect(exportText).toBe('Before `code` and $x+y$ after');
    });
});
