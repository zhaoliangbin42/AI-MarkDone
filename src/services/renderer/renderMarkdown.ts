import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import createDOMPurify from 'dompurify';

let configured = false;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureConfigured(): void {
    if (configured) return;
    configured = true;

    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
        const normalized = (lang || '').trim().toLowerCase();
        const escaped = escapeHtml(text);

        const className = normalized ? ` class="language-${escapeHtml(normalized)}"` : '';
        const dataAttr = normalized ? ` data-code-language="${escapeHtml(normalized)}"` : '';
        return `<pre${dataAttr}><code${className}>${escaped}</code></pre>`;
    };

    marked.use(
        markedKatex({
            throwOnError: false,
            output: 'html',
        })
    );
    marked.setOptions({
        gfm: true,
        breaks: false,
        renderer,
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
