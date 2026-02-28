import type { Rule } from '../../core/Rule';

function normalizeCodeBlockText(raw: string): string {
    let code = raw.replace(/\r\n?/g, '\n');
    code = code.replace(/^\n/, '').replace(/\n$/, '');

    const lines = code.split('\n');
    const nonEmpty = lines.filter((line) => line.trim().length > 0);
    if (nonEmpty.length === 0) return code;

    const indents = nonEmpty.map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
    const commonIndent = Math.min(...indents);
    if (commonIndent > 0) return lines.map((line) => line.slice(commonIndent)).join('\n');
    return code;
}

export function createCodeBlockRule(): Rule {
    return {
        name: 'code-block',
        filter: (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            const elem = node as Element;
            return elem.tagName === 'PRE' && elem.querySelector('code') !== null;
        },
        priority: 3,
        replacement: (_content, node, context) => {
            const preElem = node as HTMLElement;
            const codeElem = preElem.querySelector('code') as HTMLElement | null;
            if (!codeElem) {
                return `\`\`\`\n${preElem.textContent || ''}\n\`\`\`\n\n`;
            }
            const language = context.adapter.getCodeLanguage(codeElem);
            const code = normalizeCodeBlockText(codeElem.textContent || '');
            if (language) return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
            return `\`\`\`\n${code}\n\`\`\`\n\n`;
        },
    };
}

