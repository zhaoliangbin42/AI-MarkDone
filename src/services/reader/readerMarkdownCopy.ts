import { copyTextToClipboard } from '../../drivers/content/clipboard/clipboard';
import { resolveContent, type ReaderItem } from './types';

export async function resolveReaderItemMarkdown(item: ReaderItem): Promise<string> {
    return resolveContent(item.content);
}

export async function copyReaderItemMarkdownToClipboard(item: ReaderItem): Promise<boolean> {
    const markdown = await resolveContent(item.content);
    return copyTextToClipboard(markdown);
}
