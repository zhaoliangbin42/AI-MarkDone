function normalizeBlockMath(markdown: string): string {
    return markdown.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content: string) => {
        const normalized = String(content).replace(/\r\n?/g, '\n').replace(/\n\s*\n/g, '\n').trim();
        return `$$\n${normalized}\n$$`;
    });
}

function normalizeLatexDelimiters(markdown: string): string {
    let result = markdown;

    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, content: string) => {
        const normalized = String(content).replace(/\r\n?/g, '\n').trim();
        return `\n\n$$\n${normalized}\n$$\n\n`;
    });

    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, content: string) => {
        const normalized = String(content).replace(/\r\n?/g, ' ').replace(/\s+/g, ' ').trim();
        return `$${normalized}$`;
    });

    return result;
}

export function normalizeChatGPTReaderMarkdown(markdown: string): string {
    const source = markdown || '';
    const withLatexDelimiters = normalizeLatexDelimiters(source);
    const withBlockMath = normalizeBlockMath(withLatexDelimiters);
    return withBlockMath.replace(/\n{3,}/g, '\n\n').trim();
}
