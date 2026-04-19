import type {
    BookmarksDocBlock,
    BookmarksDocSection,
    ParsedBookmarksDoc,
    ParsedChangelogDoc,
    ParsedChangelogEntry,
    ParsedFaqDoc,
    ParsedFaqItem,
} from './types';

function normalize(raw: string): string[] {
    return raw.replace(/\r\n/g, '\n').split('\n');
}

function isH1(line: string): boolean {
    return line.startsWith('# ');
}

function isH2(line: string): boolean {
    return line.startsWith('## ');
}

function isListItem(line: string): boolean {
    return line.startsWith('- ');
}

function isDate(line: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(line.trim());
}

function parseMarkdownImage(line: string): { alt: string; src: string } | null {
    const match = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (!match) return null;
    const alt = match[1]?.trim() ?? '';
    const src = match[2]?.trim() ?? '';
    if (!src) return null;
    if (
        src.startsWith('http://')
        || src.startsWith('https://')
        || src.startsWith('data:')
        || src.startsWith('/')
        || src.includes('..')
    ) {
        return null;
    }
    return { alt, src };
}

function pushParagraphBlock(target: BookmarksDocBlock[], lines: string[]): void {
    const text = lines.map((line) => line.trim()).join(' ').trim();
    if (text) target.push({ type: 'paragraph', text });
}

function parseBlocks(lines: string[]): BookmarksDocBlock[] {
    const blocks: BookmarksDocBlock[] = [];
    let paragraphLines: string[] = [];
    let listItems: string[] = [];

    const flushParagraph = () => {
        if (!paragraphLines.length) return;
        pushParagraphBlock(blocks, paragraphLines);
        paragraphLines = [];
    };

    const flushList = () => {
        if (!listItems.length) return;
        blocks.push({ type: 'list', items: listItems });
        listItems = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }
        const image = parseMarkdownImage(line);
        if (image) {
            flushParagraph();
            flushList();
            blocks.push({ type: 'image', ...image });
            continue;
        }
        if (isListItem(line)) {
            flushParagraph();
            listItems.push(line.slice(2).trim());
            continue;
        }
        flushList();
        paragraphLines.push(line);
    }

    flushParagraph();
    flushList();
    return blocks;
}

export function parseBookmarksDoc(raw: string): ParsedBookmarksDoc {
    const lines = normalize(raw);
    let title = '';
    const leadLines: string[] = [];
    const sectionsRaw: Array<{ heading: string; lines: string[] }> = [];
    let currentSection: { heading: string; lines: string[] } | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (isH1(line)) {
            if (!title) {
                title = line.slice(2).trim();
                continue;
            }
            continue;
        }
        if (isH2(line)) {
            currentSection = {
                heading: line.slice(3).trim(),
                lines: [],
            };
            sectionsRaw.push(currentSection);
            continue;
        }
        if (currentSection) {
            currentSection.lines.push(rawLine);
            continue;
        }
        leadLines.push(rawLine);
    }

    const sections: BookmarksDocSection[] = sectionsRaw.map((section) => ({
        heading: section.heading,
        blocks: parseBlocks(section.lines),
    }));

    return {
        title,
        leadBlocks: parseBlocks(leadLines),
        sections,
    };
}

export function parseFaqDoc(raw: string): ParsedFaqDoc {
    const base = parseBookmarksDoc(raw);
    const items: ParsedFaqItem[] = base.sections.map((section) => ({
        question: section.heading,
        blocks: section.blocks,
    }));
    return {
        title: base.title,
        leadBlocks: base.leadBlocks,
        items,
    };
}

function parseChangelogEntry(sectionRaw: string): ParsedChangelogEntry {
    const lines = normalize(sectionRaw).filter((line, index) => index === 0 || line.trim() !== '');
    const heading = lines[0]?.trim() ?? '';
    const version = heading.replace(/^#\s+/, '').trim();
    const bodyLines = lines.slice(1);

    let date = '';
    let startIndex = 0;
    while (startIndex < bodyLines.length && !bodyLines[startIndex].trim()) startIndex += 1;
    if (startIndex < bodyLines.length && isDate(bodyLines[startIndex].trim())) {
        date = bodyLines[startIndex].trim();
        startIndex += 1;
    }

    const blocks = parseBlocks(bodyLines.slice(startIndex));
    const listBlock = blocks.find((block) => block.type === 'list');
    const listIndex = listBlock ? blocks.indexOf(listBlock) : -1;
    const leadBlocks = listIndex >= 0 ? blocks.slice(0, listIndex) : blocks;

    return {
        version,
        date,
        leadBlocks,
        highlights: listBlock?.type === 'list' ? listBlock.items : [],
    };
}

export function parseChangelogDoc(raw: string): ParsedChangelogDoc {
    const normalized = raw.replace(/\r\n/g, '\n');
    const matches = Array.from(normalized.matchAll(/^#\s+(.+)$/gm));
    if (!matches.length) return { title: '', entries: [] };

    const title = matches[0]?.[1]?.trim() ?? '';
    const entries: ParsedChangelogEntry[] = [];

    for (let index = 1; index < matches.length; index += 1) {
        const match = matches[index];
        const start = match.index ?? 0;
        const end = matches[index + 1]?.index ?? normalized.length;
        const sectionRaw = normalized.slice(start, end).trim();
        if (!sectionRaw) continue;
        entries.push(parseChangelogEntry(sectionRaw));
    }

    return { title, entries };
}
