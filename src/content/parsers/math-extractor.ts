import { logger } from '../../utils/logger';

/**
 * Math formula extractor that handles three scenarios:
 * 1. Successfully rendered KaTeX (with <annotation encoding="application/x-tex">)
 * 2. Failed KaTeX rendering (<span class="katex-error">)
 * 3. Raw LaTeX in text nodes (\[...\], \(...\))
 */
export class MathExtractor {
    private placeholderMap: Map<string, string> = new Map();
    private placeholderCounter = 0;

    /**
     * Extract all math formulas from HTML and replace with placeholders
     * Returns modified HTML with placeholders
     */
    extract(html: string): string {
        this.placeholderMap.clear();
        this.placeholderCounter = 0;

        // Clone to avoid modifying original
        const tempDiv = parseHtmlToContainer(html);

        // Process in order of priority
        // 1. Successfully rendered KaTeX (block display)
        this.extractKatexDisplay(tempDiv);

        // 2. Successfully rendered KaTeX (inline)
        this.extractKatexInline(tempDiv);

        // 3. Failed KaTeX rendering
        this.extractKatexErrors(tempDiv);

        // 4. Raw LaTeX patterns in text nodes
        let result = tempDiv.innerHTML;
        result = this.extractRawLatex(result);

        return result;
    }

    /**
     * Restore placeholders with formatted Markdown math
     */
    restore(markdown: string): string {
        let result = markdown;

        logger.debug('[MathExtractor] Restoring placeholders, map size:', this.placeholderMap.size);

        this.placeholderMap.forEach((latex, placeholder) => {
            const count = (result.match(new RegExp(placeholder, 'g')) || []).length;
            logger.debug(`[MathExtractor] Replacing ${placeholder} (found ${count} times)`);
            result = result.split(placeholder).join(latex);
        });

        // Post-process: normalize block math (remove extra blank lines between $$)
        // Match $$...$$  and replace multiple newlines with single newlines inside
        result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content: string) => {
            // Replace multiple consecutive newlines with single newline
            const normalized = content.replace(/\n\s*\n/g, '\n');
            return `$$${normalized}$$`;
        });

        return result;
    }

    /**
     * Extract block-level KaTeX (.katex-display)
     */
    private extractKatexDisplay(container: HTMLElement): void {
        const displays = container.querySelectorAll('.katex-display');

        displays.forEach((display) => {
            const katexSpan = display.querySelector('.katex');
            if (!katexSpan) return;

            const annotation = katexSpan.querySelector('annotation[encoding="application/x-tex"]');
            if (!annotation) return;

            const latex = this.cleanLatex(annotation.textContent || '');
            if (!latex) return;

            // Format as block math with proper newlines
            const formatted = `\n\n$$\n${latex}\n$$\n\n`;
            const placeholder = this.generatePlaceholder(formatted);

            // Replace entire .katex-display element
            const span = document.createElement('span');
            span.textContent = placeholder;
            display.replaceWith(span);

            logger.debug('[MathExtractor] Extracted block math', { length: latex.length });
        });
    }

    /**
     * Extract inline KaTeX (not inside .katex-display)
     */
    private extractKatexInline(container: HTMLElement): void {
        // Find all .katex that are NOT inside .katex-display
        const allKatex = container.querySelectorAll('.katex');

        allKatex.forEach((katex) => {
            // Skip if inside .katex-display (already processed)
            if (katex.closest('.katex-display')) return;

            const annotation = katex.querySelector('annotation[encoding="application/x-tex"]');
            if (!annotation) return;

            const latex = this.cleanLatex(annotation.textContent || '');
            if (!latex) return;

            // Format as inline math
            const formatted = `$${latex}$`;
            const placeholder = this.generatePlaceholder(formatted);

            // Replace the .katex element
            const span = document.createElement('span');
            span.textContent = placeholder;
            katex.replaceWith(span);

            logger.debug('[MathExtractor] Extracted inline math', { length: latex.length });
        });
    }

    /**
     * Extract failed KaTeX rendering (.katex-error)
     */
    private extractKatexErrors(container: HTMLElement): void {
        const errors = container.querySelectorAll('.katex-error');

        errors.forEach((error) => {
            const latex = this.cleanLatex(error.textContent || '');
            if (!latex) return;

            // Heuristic: determine if block or inline
            // Block indicators: starts with \[ or contains display-mode commands
            const isBlock = latex.startsWith('\\[') ||
                latex.includes('\\begin{') ||
                latex.includes('\\displaystyle');

            let formatted: string;
            if (isBlock) {
                // Remove \[ \] if present
                const cleaned = latex.replace(/^\\\[/, '').replace(/\\\]$/, '').trim();
                formatted = `\n\n$$\n${cleaned}\n$$\n\n`;
            } else {
                // Remove \( \) if present
                const cleaned = latex.replace(/^\\\(/, '').replace(/\\\)$/, '').trim();
                formatted = `$${cleaned}$`;
            }

            const placeholder = this.generatePlaceholder(formatted);

            const span = document.createElement('span');
            span.textContent = placeholder;
            error.replaceWith(span);

            logger.debug('[MathExtractor] Extracted error math', { length: latex.length });
        });
    }

    /**
     * Extract raw LaTeX patterns from text
     */
    private extractRawLatex(html: string): string {
        let result = html;

        // Block math: \[ ... \]
        result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, latex) => {
            const cleaned = this.cleanLatex(latex);
            const formatted = `\n\n$$\n${cleaned}\n$$\n\n`;
            return this.generatePlaceholder(formatted);
        });

        // Inline math: \( ... \)
        result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, latex) => {
            const cleaned = this.cleanLatex(latex);
            const formatted = `$${cleaned}$`;
            return this.generatePlaceholder(formatted);
        });

        return result;
    }

    /**
     * Clean LaTeX content (whitespace normalization only)
     * CRITICAL: Do NOT escape or modify LaTeX commands
     */
    private cleanLatex(latex: string): string {
        return latex
            .replace(/\s+/g, ' ')  // Merge whitespace
            .trim();               // Remove leading/trailing spaces
    }

    /**
     * Generate unique placeholder
     */
    generatePlaceholder(formatted: string): string {
        const id = `{{MATH-${this.placeholderCounter++}}}`;
        this.placeholderMap.set(id, formatted);
        return id;
    }

    /**
     * Get placeholder map for debugging
     */
    getPlaceholderMap(): Map<string, string> {
        return this.placeholderMap;
    }
}

/**
 * Enhance unrendered inline math formulas
 * 
 * Repairs ChatGPT's unrendered inline formulas where Markdown incorrectly
 * converted underscores to <em> tags. Handles complex cases where <em> tags
 * span across multiple formula boundaries.
 * 
 * Algorithm:
 * 1. Convert block innerHTML to string
 * 2. Replace <em>text</em> with _text_ (underscore markers)
 * 3. Parse the text to identify $...$ regions
 * 4. Inside formula regions: keep underscores
 * 5. Outside formula regions: restore <em> tags
 * 
 * @param element - DOM element to process (will be mutated)
 */
export function enhanceUnrenderedMath(element: HTMLElement): void {
    // Block-level elements that serve as isolation boundaries
    const BLOCK_SELECTORS = 'p, li, blockquote, td, th, dt, dd';

    // Select all block elements, or use root if it's a block itself
    const blocks = element.querySelectorAll(BLOCK_SELECTORS);
    const elementsToProcess: HTMLElement[] = blocks.length > 0
        ? Array.from(blocks) as HTMLElement[]
        : [element];

    let totalEnhanced = 0;

    for (const block of elementsToProcess) {
        // Skip blocks that contain rendered KaTeX (already processed correctly)
        if (block.querySelector('.katex, .katex-display')) {
            continue;
        }

        // Skip if no <em> tags
        if (!block.querySelector('em')) {
            continue;
        }

        // Skip if no $ signs in text
        const textContent = block.textContent || '';
        if (!textContent.includes('$')) {
            continue;
        }

        const enhanced = processBlockWithTextApproach(block);
        totalEnhanced += enhanced;
    }

    if (totalEnhanced > 0) {
        logger.debug(`[MathExtractor] Enhanced ${totalEnhanced} blocks with unrendered formulas`);
    }
}

/**
 * Process a block using text-based approach for robust formula repair
 * 
 * @param block - Block element to process
 * @returns 1 if block was modified, 0 otherwise
 */
function processBlockWithTextApproach(block: HTMLElement): number {
    let html = block.innerHTML;

    // Step 1: Replace all <em>text</em> with a marker: §EM_START§text§EM_END§
    // Using § as marker since it's unlikely to appear in math or normal text
    const EM_START = '§EM_START§';
    const EM_END = '§EM_END§';

    const emPattern = /<em[^>]*>([^<]*)<\/em>/gi;
    let hasEm = false;

    html = html.replace(emPattern, (_match, content) => {
        hasEm = true;
        return `${EM_START}${content}${EM_END}`;
    });

    if (!hasEm) {
        return 0;
    }

    // Step 2: Parse and identify formula regions
    // Find all $ positions (excluding $$)
    const result = processFormulaRegions(html, EM_START, EM_END);

    if (result === html) {
        return 0; // No changes made
    }

    // Step 3: Apply the modified HTML back to the block
    const wrapper = parseHtmlToContainer(result);
    if (wrapper) {
        const fragment = document.createDocumentFragment();
        Array.from(wrapper.childNodes).forEach((node) => {
            fragment.appendChild(document.importNode(node, true));
        });
        block.replaceChildren(fragment);
    }

    return 1;
}

function parseHtmlToContainer(html: string): HTMLDivElement {
    const parsed = new DOMParser().parseFromString(`<div id="aimd-math-root">${html}</div>`, 'text/html');
    const wrapper = parsed.getElementById('aimd-math-root');
    if (wrapper && wrapper instanceof HTMLDivElement) {
        return wrapper;
    }
    const fallback = document.createElement('div');
    fallback.textContent = html;
    return fallback;
}

/**
 * Process formula regions in HTML string
 * 
 * Inside $...$ regions: convert markers to underscores
 * Outside $...$ regions: restore markers to <em> tags
 * 
 * @param html - HTML string with EM markers
 * @param emStart - Start marker for <em>
 * @param emEnd - End marker for </em>
 * @returns Processed HTML string
 */
function processFormulaRegions(html: string, emStart: string, emEnd: string): string {
    const result: string[] = [];
    let pos = 0;
    let inFormula = false;

    while (pos < html.length) {
        // Check for $$ (block math - skip both)
        if (html[pos] === '$' && html[pos + 1] === '$') {
            result.push('$$');
            pos += 2;
            continue;
        }

        // Check for $ (toggle formula state)
        if (html[pos] === '$') {
            result.push('$');
            inFormula = !inFormula;
            pos++;
            continue;
        }

        // Check for EM_START marker
        if (html.substring(pos, pos + emStart.length) === emStart) {
            // Find the matching EM_END
            const startPos = pos + emStart.length;
            const endPos = html.indexOf(emEnd, startPos);

            if (endPos === -1) {
                // No matching end, just skip the marker
                result.push(emStart);
                pos += emStart.length;
                continue;
            }

            const content = html.substring(startPos, endPos);

            if (inFormula) {
                // Inside formula: convert to underscores
                result.push(`_${content}_`);
            } else {
                // Outside formula: restore <em> tag
                result.push(`<em>${content}</em>`);
            }

            pos = endPos + emEnd.length;
            continue;
        }

        // Regular character
        result.push(html[pos]);
        pos++;
    }

    return result.join('');
}
