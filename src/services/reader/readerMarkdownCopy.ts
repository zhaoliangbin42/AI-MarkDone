import { copyTextToClipboard } from '../../drivers/content/clipboard/clipboard';
import { copyCanonicalMarkdownToClipboard, formatCanonicalMarkdownForCopy } from '../copy/canonicalMarkdownCopy';
import { resolveContent, type ReaderItem } from './types';
import { projectChatGPTMarkdown, omitMarkdownCodeBlocks } from '../../core/content/chatgptMarkdownCleanup';
import { DEFAULT_CONTENT_CLEANUP_SETTINGS, type ContentCleanupSettings } from '../../core/settings/content';

export async function resolveReaderItemMarkdown(item: ReaderItem): Promise<string> {
    return resolveContent(item.content);
}

export async function resolveReaderItemOutputMarkdown(
    item: ReaderItem,
    settings: ContentCleanupSettings = DEFAULT_CONTENT_CLEANUP_SETTINGS,
): Promise<string> {
    if (!settings.preserveLinks && settings.includeCodeBlocks) return resolveContent(item.content);
    if (!settings.preserveLinks) return omitMarkdownCodeBlocks(await resolveContent(item.content));
    if (item.sourceContent !== undefined) {
        return projectChatGPTMarkdown(await resolveContent(item.sourceContent), settings);
    }
    const markdown = await resolveContent(item.content);
    return settings.includeCodeBlocks ? markdown : omitMarkdownCodeBlocks(markdown);
}

export async function copyReaderItemMarkdownToClipboard(
    item: ReaderItem,
    settings: ContentCleanupSettings = DEFAULT_CONTENT_CLEANUP_SETTINGS,
): Promise<boolean> {
    if (item.meta?.sourceQuality === 'reconstructed') return false;
    const markdown = !settings.preserveLinks && settings.includeCodeBlocks
        ? await resolveContent(item.content)
        : await resolveReaderItemOutputMarkdown(item, settings);
    return copyCanonicalMarkdownToClipboard(markdown);
}

export async function copyReaderPromptReplyToClipboard(
    item: ReaderItem,
    settings: ContentCleanupSettings = DEFAULT_CONTENT_CLEANUP_SETTINGS,
    isCurrent?: () => boolean,
): Promise<boolean> {
    if (item.meta?.sourceQuality === 'reconstructed' || !item.userPrompt.trim()) return false;
    const reply = await resolveReaderItemOutputMarkdown(item, settings);
    if (!reply.trim() || (isCurrent && !isCurrent())) return false;
    return copyTextToClipboard(`## User Prompt\n\n${item.userPrompt}\n\n## AI Reply\n\n${formatCanonicalMarkdownForCopy(reply)}`);
}
