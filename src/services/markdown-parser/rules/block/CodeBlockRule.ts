import type { Rule } from '../../core/Rule';

type AdapterWithCustomCodeExtraction = {
    extractCodeBlockText?: (blockElem: HTMLElement) => string | null;
};

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
        filter: (node, adapter) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            return adapter.isCodeBlockNode(node as Element);
        },
        priority: 3,
        replacement: (_content, node, context) => {
            const blockElem = node as HTMLElement;
            const adapter = context.adapter as typeof context.adapter & AdapterWithCustomCodeExtraction;
            const customCode = adapter.extractCodeBlockText?.(blockElem);
            const codeElem =
                blockElem.tagName === 'CODE'
                    ? blockElem
                    : ((blockElem.querySelector('code') as HTMLElement | null) || (blockElem.matches('pre') ? blockElem : null));
            if (customCode !== undefined && customCode !== null) {
                const language = context.adapter.getCodeLanguage(blockElem);
                const code = normalizeCodeBlockText(customCode);
                if (language) return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
                return `\`\`\`\n${code}\n\`\`\`\n\n`;
            }
            if (!codeElem) {
                return `\`\`\`\n${blockElem.textContent || ''}\n\`\`\`\n\n`;
            }
            const language = context.adapter.getCodeLanguage(codeElem);
            const code = normalizeCodeBlockText(codeElem.textContent || '');
            if (language) return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
            return `\`\`\`\n${code}\n\`\`\`\n\n`;
        },
    };
}
