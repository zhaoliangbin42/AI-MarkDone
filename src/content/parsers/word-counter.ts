/**
 * Word counter that handles CJK and Latin text separately
 * Excludes code blocks and math formulas from counting
 * CJK: 1 character = 1 word + 2 chars
 * Latin: 1 word = 1 word + word.length chars
 */
export interface WordCountResult {
  words: number;   // Total word count
  chars: number;   // Total character count
  cjk: number;     // CJK character count
  latin: number;   // Latin word count
  excluded: {
    codeBlocks: number;
    mathFormulas: number;
  };
}

export class WordCounter {
  /**
   * Count words in Markdown text
   */
  count(markdown: string): WordCountResult {
    // Track excluded content
    const excluded = {
      codeBlocks: 0,
      mathFormulas: 0
    };

    // Remove code blocks and count them
    let cleaned = markdown.replace(/```[\s\S]*?```/g, () => {
      excluded.codeBlocks++;
      return '';
    });

    // Remove math formulas and count them
    cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, () => {
      excluded.mathFormulas++;
      return '';
    });

    cleaned = cleaned.replace(/\$[^\$\n]+\$/g, () => {
      excluded.mathFormulas++;
      return '';
    });

    // Remove inline code
    cleaned = cleaned.replace(/`[^`]+`/g, '');

    // Count CJK characters (Chinese, Japanese, Korean)
    const cjkPattern = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
    const cjkMatches = cleaned.match(cjkPattern) || [];
    const cjk = cjkMatches.length;

    // Remove CJK characters for Latin word counting
    const latinText = cleaned.replace(cjkPattern, ' ');

    // Count Latin words
    const latinWords = latinText
      .split(/\s+/)
      .filter(word => {
        // Remove punctuation and check if word has actual letters
        const cleanWord = word.replace(/[^\w]/g, '');
        return cleanWord.length > 0;
      });
    const latin = latinWords.length;
    
    // Count Latin characters (sum of all word lengths)
    const latinChars = latinWords.reduce((sum, word) => {
      const cleanWord = word.replace(/[^\w]/g, '');
      return sum + cleanWord.length;
    }, 0);

    return {
      words: cjk + latin,           // CJK: 1 char = 1 word, Latin: 1 word = 1 word
      chars: (cjk * 2) + latinChars, // CJK: 1 char = 2 chars, Latin: actual length
      cjk,
      latin,
      excluded
    };
  }

  /**
   * Format count result as human-readable string
   */
  format(result: WordCountResult): string {
    // Treat code-only content as valid "0 / 0" instead of "No content".
    // Why: the toolbar word count initialization uses this string to decide whether to stop showing loading.
    if (result.words === 0 && result.chars === 0 && result.excluded.codeBlocks > 0) {
      return '0 Words / 0 Chars';
    }

    if (result.words === 0 && result.chars === 0) {
      return 'No content';
    }
    
    return `${result.words} Words / ${result.chars} Chars`;
  }

  /**
   * Count words in HTML element (will parse to Markdown first)
   */
  countHTML(html: string): WordCountResult {
    // Basic HTML to text conversion for counting
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    return this.count(text);
  }
}
