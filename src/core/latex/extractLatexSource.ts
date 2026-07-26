const LATEX_ATTRIBUTE_KEYS = [
    'data-latex-source',
    'data-latex',
    'data-tex',
    'data-math',
    'data-original-tex',
] as const;

const looksLikeLatex = (value: string): boolean =>
    /\\[a-zA-Z]+/.test(value) || /\\[^\s]/.test(value) || /[_^]/.test(value);

export function normalizeExtractedLatexSource(value: string): string {
    let source = value.trim();
    const wrappers = [
        ['$$', '$$'],
        ['\\[', '\\]'],
        ['\\(', '\\)'],
        ['$', '$'],
    ] as const;

    let changed = true;
    while (changed) {
        changed = false;
        for (const [open, close] of wrappers) {
            if (
                source.length <= open.length + close.length
                || !source.startsWith(open)
                || !source.endsWith(close)
            ) {
                continue;
            }
            source = source.slice(open.length, -close.length).trim();
            changed = true;
            break;
        }
    }
    return source;
}

const getAttributeLatex = (element: Element): string | null => {
    for (const key of LATEX_ATTRIBUTE_KEYS) {
        const value = element.getAttribute(key);
        if (value && value.trim()) return normalizeExtractedLatexSource(value);
    }
    return null;
};

const getClosestAttributeLatex = (element: Element | null): string | null => {
    let current: Element | null = element;
    while (current) {
        const value = getAttributeLatex(current);
        if (value) return value;
        current = current.parentElement;
    }
    return null;
};

const getAnnotationLatex = (element: Element): string | null => {
    const annotation = element.querySelector('annotation[encoding="application/x-tex"]');
    const text = annotation?.textContent?.trim();
    return text ? normalizeExtractedLatexSource(text) : null;
};

export function extractAuthoritativeLatexSource(element: Element | null): string | null {
    if (!element) return null;
    return getClosestAttributeLatex(element) || getAnnotationLatex(element);
}

const getKatexErrorLatex = (element: Element): string | null => {
    const errorElement = element.classList.contains('katex-error')
        ? element
        : element.querySelector('.katex-error');
    if (!errorElement) return null;

    const text = errorElement.textContent?.trim() || '';
    if (!text) return null;
    const source = text.replace(/^ParseError:.*?:\s*/i, '').trim();
    if (!looksLikeLatex(source)) return null;
    return normalizeExtractedLatexSource(source);
};

const getAccessibleLatex = (element: Element): string | null => {
    const label = element.getAttribute('aria-label')?.trim()
        || element.getAttribute('title')?.trim()
        || null;
    if (!label) return null;
    if (!looksLikeLatex(label)) return null;
    return normalizeExtractedLatexSource(label);
};

export function extractLatexSource(element: Element | null): string | null {
    if (!element) return null;

    const authoritative = extractAuthoritativeLatexSource(element);
    if (authoritative) return authoritative;

    const katexErrorLatex = getKatexErrorLatex(element);
    if (katexErrorLatex) return katexErrorLatex;

    return getAccessibleLatex(element);
}
