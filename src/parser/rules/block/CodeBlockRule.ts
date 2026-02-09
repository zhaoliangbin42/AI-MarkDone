/**
 * Code Block Rule - Convert <pre><code> to ```language\n...\n```
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Code Blocks
 */

import type { Rule } from '../../core/Rule';

function normalizeCodeBlockText(raw: string): string {
    let code = raw.replace(/\r\n?/g, '\n');

    // Drop one leading/trailing blank line caused by DOM pretty-print wrappers.
    code = code.replace(/^\n/, '').replace(/\n$/, '');

    const lines = code.split('\n');
    const nonEmpty = lines.filter((line) => line.trim().length > 0);
    if (nonEmpty.length === 0) {
        return code;
    }

    const indents = nonEmpty.map((line) => {
        const match = line.match(/^[ \t]*/);
        return match ? match[0].length : 0;
    });
    const commonIndent = Math.min(...indents);

    if (commonIndent > 0) {
        return lines.map((line) => line.slice(commonIndent)).join('\n');
    }

    return code;
}

/**
 * Creates rule for code blocks (pre > code)
 * 
 * Priority: 3 (High - after math, before most blocks)
 */
export function createCodeBlockRule(): Rule {
    return {
        name: 'code-block',

        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const elem = node as Element;

            // Must be <pre> containing <code>
            return elem.tagName === 'PRE' && elem.querySelector('code') !== null;
        },

        priority: 3,

        replacement: (content, node, context) => {
            const preElem = node as HTMLElement;
            const codeElem = preElem.querySelector('code') as HTMLElement;

            if (!codeElem) {
                return `\`\`\`\n${content}\n\`\`\`\n\n`;
            }

            // Get programming language from adapter
            const language = context.adapter.getCodeLanguage(codeElem);
            const code = normalizeCodeBlockText(codeElem.textContent || '');

            if (language) {
                return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
            }

            return `\`\`\`\n${code}\n\`\`\`\n\n`;
        },
    };
}

