import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import createDOMPurify from 'dompurify';

let configured = false;

function ensureConfigured(): void {
    if (configured) return;
    configured = true;

    marked.use(
        markedKatex({
            throwOnError: false,
            output: 'html',
        })
    );
    marked.setOptions({
        gfm: true,
        breaks: false,
    });
}

export function renderMarkdownToSanitizedHtml(markdown: string): string {
    ensureConfigured();
    const rawHtml = marked.parse(markdown || '') as string;

    if (typeof window === 'undefined') {
        // Should never happen in content runtime; keep deterministic for tests.
        return rawHtml;
    }

    const dompurify = createDOMPurify(window as any);
    return dompurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
    }) as string;
}
