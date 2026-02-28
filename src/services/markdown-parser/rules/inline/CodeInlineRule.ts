import type { Rule } from '../../core/Rule';

function fenceInlineCode(code: string): string {
    const maxRun = Math.max(0, ...Array.from(code.matchAll(/`+/g)).map((m) => m[0].length));
    const fence = '`'.repeat(maxRun + 1);
    return `${fence}${code}${fence}`;
}

export function createCodeInlineRule(): Rule {
    return {
        name: 'code-inline',
        filter: ['code'],
        priority: 11,
        replacement: (content, node) => {
            const el = node as HTMLElement;
            if (el.closest('pre')) return content;
            return fenceInlineCode(content.trim());
        },
    };
}

