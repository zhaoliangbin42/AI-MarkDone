import { describe, expect, it } from 'vitest';
import { formatReaderUserPromptDisplay } from '@/services/reader/userPromptDisplay';

describe('formatReaderUserPromptDisplay', () => {
    it('keeps prompts at or under the threshold intact', () => {
        const prompt = 'a'.repeat(600);

        expect(formatReaderUserPromptDisplay(prompt)).toEqual({
            truncated: false,
            full: prompt,
            head: '',
            middle: '',
            tail: '',
        });
    });

    it('splits long prompts into head, middle, and tail excerpts', () => {
        const prompt = Array.from({ length: 1000 }, (_, index) => String(index % 10)).join('');

        expect(formatReaderUserPromptDisplay(prompt)).toEqual({
            truncated: true,
            full: prompt,
            head: prompt.slice(0, 200),
            middle: prompt.slice(400, 600),
            tail: prompt.slice(-200),
        });
    });

    it('handles empty prompts without truncation', () => {
        expect(formatReaderUserPromptDisplay('')).toEqual({
            truncated: false,
            full: '',
            head: '',
            middle: '',
            tail: '',
        });
    });
});
