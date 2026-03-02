export interface WordCountResult {
    words: number;
    chars: number;
    cjk: number;
    latin: number;
    excluded: {
        codeBlocks: number;
        mathFormulas: number;
    };
}

export class WordCounter {
    count(markdown: string): WordCountResult {
        const excluded = { codeBlocks: 0, mathFormulas: 0 };

        let cleaned = (markdown || '').replace(/```[\s\S]*?```/g, () => {
            excluded.codeBlocks++;
            return '';
        });

        cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, () => {
            excluded.mathFormulas++;
            return '';
        });

        cleaned = cleaned.replace(/\$[^\$\n]+\$/g, () => {
            excluded.mathFormulas++;
            return '';
        });

        cleaned = cleaned.replace(/`[^`]+`/g, '');

        const cjkPattern = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
        const cjkMatches = cleaned.match(cjkPattern) || [];
        const cjk = cjkMatches.length;

        const latinText = cleaned.replace(cjkPattern, ' ');
        const latinWords = latinText
            .split(/\s+/)
            .filter((word) => {
                const cleanWord = word.replace(/[^\w]/g, '');
                return cleanWord.length > 0;
            });

        const latin = latinWords.length;
        const latinChars = latinWords.reduce((sum, word) => {
            const cleanWord = word.replace(/[^\w]/g, '');
            return sum + cleanWord.length;
        }, 0);

        return {
            words: cjk + latin,
            chars: cjk * 2 + latinChars,
            cjk,
            latin,
            excluded,
        };
    }

    format(result: WordCountResult): string {
        if (result.words === 0 && result.chars === 0 && result.excluded.codeBlocks > 0) {
            return '0 Words / 0 Chars';
        }
        if (result.words === 0 && result.chars === 0) {
            return 'No content';
        }
        return `${result.words} Words / ${result.chars} Chars`;
    }

    countHTML(html: string): WordCountResult {
        const text = (html || '')
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

