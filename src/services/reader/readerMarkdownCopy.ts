import { copyCanonicalMarkdownToClipboard } from '../copy/canonicalMarkdownCopy';
import { resolveContent, type ReaderItem } from './types';

export async function resolveReaderItemMarkdown(item: ReaderItem): Promise<string> {
    return resolveContent(item.content);
}

export async function copyReaderItemMarkdownToClipboard(item: ReaderItem): Promise<boolean> {
    if (item.meta?.sourceQuality === 'reconstructed') return false;
    const markdown = await resolveContent(item.content);
    return copyCanonicalMarkdownToClipboard(markdown);
}
