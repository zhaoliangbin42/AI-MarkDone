import { logger } from '../../../core/logger';

/**
 * Extract math formulas from HTML by replacing rendered/errored KaTeX with placeholders,
 * then restore placeholders after HTML→Markdown conversion.
 *
 * Why: preserve LaTeX characters (e.g., `_`) that are frequently mis-parsed by HTML→MD rules.
 */
export class MathExtractor {
    private placeholderMap: Map<string, string> = new Map();
    private placeholderCounter = 0;

    extract(html: string): string {
        this.placeholderMap.clear();
        this.placeholderCounter = 0;

        const tempDiv = parseHtmlToContainer(html, 'aimd-math-extract-root');

        this.extractKatexDisplay(tempDiv);
        this.extractKatexInline(tempDiv);
        this.extractKatexErrors(tempDiv);

        let result = tempDiv.innerHTML;
        result = this.extractRawLatex(result);

        return result;
    }

    restore(markdown: string): string {
        let result = markdown;
        this.placeholderMap.forEach((latex, placeholder) => {
            result = result.split(placeholder).join(latex);
        });

        // Normalize block math interior whitespace.
        result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content: string) => {
            const normalized = String(content).replace(/\n\s*\n/g, '\n');
            return `$$${normalized}$$`;
        });

        return result;
    }

    private extractKatexDisplay(container: HTMLElement): void {
        const displays = container.querySelectorAll('.katex-display');
        displays.forEach((display) => {
            const katexSpan = display.querySelector('.katex');
            if (!katexSpan) return;
            const annotation = katexSpan.querySelector('annotation[encoding="application/x-tex"]');
            if (!annotation) return;

            const latex = this.cleanLatex(annotation.textContent || '');
            if (!latex) return;

            const formatted = `\n\n$$\n${latex}\n$$\n\n`;
            const placeholder = this.generatePlaceholder(formatted);

            const span = document.createElement('span');
            span.textContent = placeholder;
            display.replaceWith(span);
        });
    }

    private extractKatexInline(container: HTMLElement): void {
        const allKatex = container.querySelectorAll('.katex');
        allKatex.forEach((katex) => {
            if (katex.closest('.katex-display')) return;
            const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
            if (!annotation) return;
            const latex = this.cleanLatex(annotation.textContent || '');
            if (!latex) return;

            const formatted = `$${latex}$`;
            const placeholder = this.generatePlaceholder(formatted);

            const span = document.createElement('span');
            span.textContent = placeholder;
            katex.replaceWith(span);
        });
    }

    private extractKatexErrors(container: HTMLElement): void {
        const errors = container.querySelectorAll('.katex-error');
        errors.forEach((error) => {
            const latex = this.cleanLatex(error.textContent || '');
            if (!latex) return;

            const isBlock =
                latex.startsWith('\\[') || latex.includes('\\begin{') || latex.includes('\\displaystyle');

            let formatted: string;
            if (isBlock) {
                const cleaned = latex.replace(/^\\\[/, '').replace(/\\\]$/, '').trim();
                formatted = `\n\n$$\n${cleaned}\n$$\n\n`;
            } else {
                const cleaned = latex.replace(/^\\\(/, '').replace(/\\\)$/, '').trim();
                formatted = `$${cleaned}$`;
            }

            const placeholder = this.generatePlaceholder(formatted);
            const span = document.createElement('span');
            span.textContent = placeholder;
            error.replaceWith(span);
        });
    }

    private extractRawLatex(html: string): string {
        let result = html;

        result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, latex) => {
            const cleaned = this.cleanLatex(String(latex));
            const formatted = `\n\n$$\n${cleaned}\n$$\n\n`;
            return this.generatePlaceholder(formatted);
        });

        result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, latex) => {
            const cleaned = this.cleanLatex(String(latex));
            const formatted = `$${cleaned}$`;
            return this.generatePlaceholder(formatted);
        });

        return result;
    }

    private cleanLatex(latex: string): string {
        return latex.replace(/\s+/g, ' ').trim();
    }

    private generatePlaceholder(formatted: string): string {
        const id = `{{MATH-${this.placeholderCounter++}}}`;
        this.placeholderMap.set(id, formatted);
        return id;
    }
}

/**
 * Optional repair for platforms that present raw inline math where underscores were converted into <em>.
 * Kept here for future adapter-specific use; safe no-op when not used.
 */
export function enhanceUnrenderedMath(element: HTMLElement): void {
    const BLOCK_SELECTORS = 'p, li, blockquote, td, th, dt, dd';
    const blocks = element.querySelectorAll(BLOCK_SELECTORS);
    const elementsToProcess: HTMLElement[] = blocks.length > 0 ? (Array.from(blocks) as HTMLElement[]) : [element];

    let totalEnhanced = 0;
    for (const block of elementsToProcess) {
        if (block.querySelector('.katex, .katex-display')) continue;
        if (!block.querySelector('em')) continue;
        const textContent = block.textContent || '';
        if (!textContent.includes('$')) continue;

        totalEnhanced += processBlockWithTextApproach(block);
    }

    if (totalEnhanced > 0) {
        logger.debug(`[AI-MarkDone][Copy][MathExtractor] Enhanced ${totalEnhanced} blocks`);
    }
}

function processBlockWithTextApproach(block: HTMLElement): number {
    let html = block.innerHTML;

    const EM_START = '§EM_START§';
    const EM_END = '§EM_END§';

    const emPattern = /<em[^>]*>([^<]*)<\/em>/gi;
    let hasEm = false;

    html = html.replace(emPattern, (_match, content) => {
        hasEm = true;
        return `${EM_START}${content}${EM_END}`;
    });

    if (!hasEm) return 0;

    const result = processFormulaRegions(html, EM_START, EM_END);
    if (result === html) return 0;

    const wrapper = parseHtmlToContainer(result, 'aimd-math-enhance-root');
    const fragment = document.createDocumentFragment();
    Array.from(wrapper.childNodes).forEach((node) => {
        fragment.appendChild(document.importNode(node, true));
    });
    block.replaceChildren(fragment);

    return 1;
}

function processFormulaRegions(html: string, emStart: string, emEnd: string): string {
    const result: string[] = [];
    let pos = 0;
    let inFormula = false;

    while (pos < html.length) {
        if (html[pos] === '$' && html[pos + 1] === '$') {
            result.push('$$');
            pos += 2;
            continue;
        }
        if (html[pos] === '$') {
            result.push('$');
            inFormula = !inFormula;
            pos++;
            continue;
        }
        if (html.substring(pos, pos + emStart.length) === emStart) {
            const startPos = pos + emStart.length;
            const endPos = html.indexOf(emEnd, startPos);
            if (endPos === -1) {
                result.push(emStart);
                pos += emStart.length;
                continue;
            }
            const content = html.substring(startPos, endPos);
            if (inFormula) result.push(`_${content}_`);
            else result.push(`<em>${content}</em>`);
            pos = endPos + emEnd.length;
            continue;
        }

        result.push(html[pos]);
        pos++;
    }

    return result.join('');
}

function parseHtmlToContainer(html: string, rootId: string): HTMLDivElement {
    const parsed = new DOMParser().parseFromString(`<div id="${rootId}">${html}</div>`, 'text/html');
    const wrapper = parsed.getElementById(rootId);
    if (wrapper && wrapper instanceof HTMLDivElement) return wrapper;
    const fallback = document.createElement('div');
    fallback.textContent = html;
    return fallback;
}

