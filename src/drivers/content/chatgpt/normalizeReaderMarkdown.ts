export type ChatGPTReferenceNoiseOptions = {
    stripCitationMarkers?: boolean;
    stripMarkdownLinks?: boolean;
    stripBareUrls?: boolean;
};

const DEFAULT_CHATGPT_REFERENCE_NOISE_OPTIONS: Required<ChatGPTReferenceNoiseOptions> = {
    stripCitationMarkers: true,
    stripMarkdownLinks: true,
    stripBareUrls: true,
};

const PROTECTED_CODE_TOKEN_PREFIX = '\uE000AIMD_CODE_';
const PROTECTED_CODE_TOKEN_SUFFIX = '\uE001';

function protectMarkdownCode(markdown: string): { masked: string; restore: (value: string) => string } {
    const protectedBlocks: string[] = [];
    const protect = (value: string): string => {
        const index = protectedBlocks.push(value) - 1;
        return `${PROTECTED_CODE_TOKEN_PREFIX}${index}${PROTECTED_CODE_TOKEN_SUFFIX}`;
    };

    const maskedFences = markdown.replace(
        /^([ \t]*)(`{3,}|~{3,})[^\n]*(?:\n[\s\S]*?^\1\2[ \t]*$|[\s\S]*$)/gm,
        (match) => protect(match)
    );
    const masked = maskedFences.replace(/`[^`\n]+`/g, (match) => protect(match));

    return {
        masked,
        restore(value: string): string {
            return value.replace(
                new RegExp(`${PROTECTED_CODE_TOKEN_PREFIX}(\\d+)${PROTECTED_CODE_TOKEN_SUFFIX}`, 'g'),
                (_match, index: string) => protectedBlocks[Number(index)] ?? ''
            );
        },
    };
}

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

export function cleanChatGPTReferenceNoise(
    markdown: string,
    options: ChatGPTReferenceNoiseOptions = DEFAULT_CHATGPT_REFERENCE_NOISE_OPTIONS,
): string {
    const resolved = { ...DEFAULT_CHATGPT_REFERENCE_NOISE_OPTIONS, ...options };
    const protectedCode = protectMarkdownCode(markdown || '');
    let result = protectedCode.masked;

    if (resolved.stripCitationMarkers) {
        result = stripCitationMarkers(result);
    }

    if (resolved.stripMarkdownLinks) {
        result = stripMarkdownLinks(result);
    }

    if (resolved.stripBareUrls) {
        result = stripBareUrls(result);
    }

    const normalized = result
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return protectedCode.restore(normalized);
}

export function normalizeChatGPTReaderMarkdown(markdown: string, cleanupOptions?: ChatGPTReferenceNoiseOptions): string {
    const source = markdown || '';
    const cleaned = cleanChatGPTReferenceNoise(source, cleanupOptions);
    const withLatexDelimiters = normalizeLatexDelimiters(cleaned);
    const withBlockMath = normalizeBlockMath(withLatexDelimiters);
    return withBlockMath.replace(/\n{3,}/g, '\n\n').trim();
}

function stripCitationMarkers(markdown: string): string {
    return markdown
        .replace(/(?:file)?cite[^]*/g, '')
        .replace(/【[^】]*(?:†|source|来源|引用|文件|file)[^】]*】/gi, '')
        .replace(/\[(?:source|sources|citation|citations|引用|来源)\]/gi, '');
}

function stripMarkdownLinks(markdown: string): string {
    return markdown.replace(/!?\[([^\]\n]*)\]\(([^)\n]+)\)/g, (_match, label: string) => {
        const text = String(label || '').trim();
        return text;
    });
}

function stripBareUrls(markdown: string): string {
    return markdown
        .replace(/https?:\/\/[^\s<>)\]]+/g, '')
        .replace(/<https?:\/\/[^>\s]+>/g, '');
}
