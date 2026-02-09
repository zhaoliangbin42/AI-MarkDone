import { logger } from '../../utils/logger';

/**
 * Code block extractor that preserves language identifiers
 * Handles both <pre><code> and standalone <code> elements
 */
export class CodeExtractor {
  private placeholderMap: Map<string, string> = new Map();
  private placeholderCounter = 0;

  /**
   * Extract all code blocks from HTML and replace with placeholders
   */
  extract(html: string): string {
    this.placeholderMap.clear();
    this.placeholderCounter = 0;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Process <pre><code> blocks (fenced code blocks)
    this.extractPreCodeBlocks(tempDiv);

    // Note: Inline <code> will be handled by Turndown naturally
    // We only need to protect block-level code

    return tempDiv.innerHTML;
  }

  /**
   * Restore placeholders with formatted code blocks
   */
  restore(markdown: string): string {
    let result = markdown;
    
    this.placeholderMap.forEach((code, placeholder) => {
      result = result.split(placeholder).join(code);
    });

    return result;
  }

  /**
   * Extract <pre><code> blocks
   */
  private extractPreCodeBlocks(container: HTMLElement): void {
    const preBlocks = container.querySelectorAll('pre');

    preBlocks.forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;

      // Extract language from class (e.g., "language-python")
      const language = this.extractLanguage(code);
      
      // Get code content (preserve newlines and indentation)
      const content = code.textContent || '';

      // Format as fenced code block
      const formatted = this.formatCodeBlock(content, language);
      const placeholder = this.generatePlaceholder(formatted);

      // Replace entire <pre> element
      const span = document.createElement('span');
      span.textContent = placeholder;
      pre.replaceWith(span);

      logger.debug('[CodeExtractor] Extracted code block', {
        language: language || 'plain',
        length: content.length
      });
    });
  }

  /**
   * Extract language identifier from code element
   */
  private extractLanguage(code: HTMLElement): string {
    // Check common patterns:
    // 1. class="language-python"
    // 2. class="hljs python"
    // 3. data-language="python"
    
    const className = code.className || '';
    
    // Match language-xxx or hljs xxx
    const langMatch = className.match(/language-(\w+)|hljs\s+(\w+)/);
    if (langMatch) {
      return langMatch[1] || langMatch[2];
    }

    // Check data attribute
    const dataLang = code.getAttribute('data-language');
    if (dataLang) return dataLang;

    return ''; // No language identifier
  }

  /**
   * Format code block with proper fencing
   */
  private formatCodeBlock(content: string, language: string): string {
    // Normalize pretty-printed HTML indentation while preserving relative indent in code.
    const normalized = this.normalizeCodeIndent(content).trimEnd();
    
    // Format: \n\n```lang\ncode\n```\n\n
    return `\n\n\`\`\`${language}\n${normalized}\n\`\`\`\n\n`;
  }

  private normalizeCodeIndent(raw: string): string {
    const text = String(raw || '').replace(/\r\n?/g, '\n').replace(/^\n/, '');
    const lines = text.split('\n');
    const nonEmpty = lines.filter((line) => line.trim().length > 0);

    if (nonEmpty.length === 0) {
      return text;
    }

    const indents = nonEmpty.map((line) => {
      const match = line.match(/^[ \t]*/);
      return match ? match[0].length : 0;
    });
    const commonIndent = Math.min(...indents);

    if (commonIndent <= 0) {
      return text;
    }

    return lines.map((line) => line.slice(commonIndent)).join('\n');
  }

  /**
   * Generate unique placeholder
   */
  private generatePlaceholder(formatted: string): string {
    const id = `{{CODE-${this.placeholderCounter++}}}`;
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
