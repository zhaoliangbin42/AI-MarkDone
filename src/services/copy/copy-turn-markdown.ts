import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { copyMarkdownFromMessage, type CopyMarkdownResult } from './copy-markdown';

export function copyMarkdownFromTurn(adapter: SiteAdapter, messageEls: HTMLElement[]): CopyMarkdownResult {
    let firstError: any = null;
    const parts: string[] = [];
    const sourceParts:string[]=[];

    for (const el of messageEls) {
        const res = copyMarkdownFromMessage(adapter, el);
        if (res.ok) {
            const trimmed = res.markdown.trim();
            if (trimmed) {parts.push(trimmed);sourceParts.push(res.sourceMarkdown??trimmed);}
            continue;
        }
        if (!firstError) firstError = res.error as any;
    }

    const markdown = parts.join('\n\n');
    if (markdown) return { ok: true, markdown, ...(sourceParts.join('\n\n')!==markdown?{sourceMarkdown:sourceParts.join('\n\n')}:{}) };
    if (firstError) return { ok: false, error: firstError as any };
    return { ok: true, markdown: '' };
}
