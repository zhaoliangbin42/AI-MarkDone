/**
 * Code Block Rule - Convert <pre><code> to ```language\n...\n```
 * 
 * @see DEVELOPER-REFERENCE-MANUAL.md - Syntax Conversion Quick Reference
 * @see Syntax-Mapping-Spec.md - Code Blocks
 */

import type { Rule } from '../../core/Rule';

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
            const code = codeElem.textContent || '';

            if (language) {
                return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
            }

            return `\`\`\`\n${code}\n\`\`\`\n\n`;
        },
    };
}


