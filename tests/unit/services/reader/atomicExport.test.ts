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
                    mode: 'atomic',
                    source: '`code`',
                    start: 7,
                    end: 13,
                    element: paragraph.querySelector('[data-aimd-unit-id="u1"]') as HTMLElement,
                },
                {
                    id: 'u2',
                    kind: 'inline-math',
                    mode: 'atomic',
                    source: '$x+y$',
                    start: 18,
                    end: 23,
                    element: paragraph.querySelector('[data-aimd-unit-id="u2"]') as HTMLElement,
                },
            ],
        });

        expect(exportText).toBe('Before `code` and $x+y$ after');
    });

    it('keeps partial structural selections as visible text slices', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <h2 data-aimd-unit-id="h1" data-aimd-unit-kind="heading" data-aimd-unit-mode="structural">Heading</h2>
          </div>
        `;
        const text = root.querySelector('h2')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 2);
        range.setEnd(text, text.data.length);

        const exportText = buildAtomicSelectionExport({
            range,
            root,
            selectedUnits: [],
        });

        expect(exportText).toBe('ading');
    });

    it('keeps selected text inside an unselected text-selectable atomic unit', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <p><code data-aimd-unit-id="code1">answer</code> and <span data-aimd-unit-id="math1">x+y</span></p>
          </div>
        `;
        const paragraph = root.querySelector('p')!;
        const codeText = paragraph.querySelector('code')!.firstChild as Text;
        const mathText = paragraph.querySelector('[data-aimd-unit-id="math1"]')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(mathText, mathText.textContent!.length);

        const exportText = buildAtomicSelectionExport({
            range,
            root,
            selectedUnits: [
                {
                    id: 'math1',
                    kind: 'inline-math',
                    mode: 'atomic',
                    source: '$x+y$',
                    start: 18,
                    end: 23,
                    element: paragraph.querySelector('[data-aimd-unit-id="math1"]') as HTMLElement,
                },
            ],
        });

        expect(exportText).toBe('answer and $x+y$');
    });

    it('exports a fully selected code block as fenced markdown source', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <pre data-aimd-unit-id="code1"><code>const answer = 42;</code></pre>
          </div>
        `;
        const codeText = root.querySelector('code')!.firstChild as Text;
        const codeBlock = root.querySelector('pre') as HTMLElement;
        const range = document.createRange();
        range.setStart(codeText, 0);
        range.setEnd(codeText, codeText.data.length);

        const exportText = buildAtomicSelectionExport({
            range,
            root,
            selectedUnits: [
                {
                    id: 'code1',
                    kind: 'code-block',
                    mode: 'atomic',
                    source: '```ts\nconst answer = 42;\n```',
                    start: 0,
                    end: 29,
                    element: codeBlock,
                },
            ],
        });

        expect(exportText).toBe('```ts\nconst answer = 42;\n```');
    });

    it('exports fully selected structural units as markdown source', () => {
        const root = document.createElement('div');
        root.innerHTML = `
          <div class="reader-markdown">
            <h2 data-aimd-unit-id="h1" data-aimd-unit-kind="heading" data-aimd-unit-mode="structural">Heading</h2>
            <ul>
              <li data-aimd-unit-id="li1" data-aimd-unit-kind="list-item" data-aimd-unit-mode="structural">First item</li>
              <li data-aimd-unit-id="li2" data-aimd-unit-kind="list-item" data-aimd-unit-mode="structural">Second item</li>
            </ul>
          </div>
        `;
        const headingText = root.querySelector('h2')!.firstChild as Text;
        const secondText = root.querySelectorAll('li')[1]!.firstChild as Text;
        const range = document.createRange();
        range.setStart(headingText, 0);
        range.setEnd(secondText, secondText.data.length);

        const exportText = buildAtomicSelectionExport({
            range,
            root,
            selectedUnits: [
                {
                    id: 'h1',
                    kind: 'heading',
                    mode: 'structural',
                    source: '## Heading',
                    start: 0,
                    end: 10,
                    element: root.querySelector('[data-aimd-unit-id="h1"]') as HTMLElement,
                },
                {
                    id: 'li1',
                    kind: 'list-item',
                    mode: 'structural',
                    source: '- First item',
                    start: 12,
                    end: 24,
                    element: root.querySelector('[data-aimd-unit-id="li1"]') as HTMLElement,
                },
                {
                    id: 'li2',
                    kind: 'list-item',
                    mode: 'structural',
                    source: '- Second item',
                    start: 25,
                    end: 38,
                    element: root.querySelector('[data-aimd-unit-id="li2"]') as HTMLElement,
                },
            ],
        });

        expect(exportText).toBe(['## Heading', '- First item', '- Second item'].join('\n\n'));
    });
});
