/**
 * Contenteditable serialization utilities.
 *
 * These are copied from legacy `MessageSender` semantics:
 * - Preserve exact newlines across ProseMirror-like structures.
 * - Apply plain text via safe node composition (no unsafe innerHTML).
 */

/**
 * Parse contenteditable HTML to plain text, preserving exact newlines.
 *
 * ProseMirror structure:
 * - Each <p> represents one line
 * - Empty lines are <p><br></p> (br is a placeholder, not an extra newline)
 */
export function parseContenteditableToPlainText(element: HTMLElement): string {
    const blocks = element.querySelectorAll('p, div');

    if (blocks.length > 0) {
        const lines: string[] = [];
        blocks.forEach((block) => {
            const text = block.textContent || '';
            lines.push(text);
        });
        return lines.join('\n');
    }

    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('br').forEach((br) => {
        br.replaceWith('\n');
    });

    return clone.textContent || '';
}

/**
 * Apply plain text to contenteditable as ProseMirror-like block structure.
 */
export function applyPlainTextToContenteditable(input: HTMLElement, text: string): void {
    const lines = text.split('\n');
    const nodes: HTMLElement[] = lines.map((line) => {
        const p = document.createElement('p');
        if (line === '') {
            p.appendChild(document.createElement('br'));
        } else {
            p.textContent = line;
        }
        return p;
    });

    input.replaceChildren(...nodes);
}

