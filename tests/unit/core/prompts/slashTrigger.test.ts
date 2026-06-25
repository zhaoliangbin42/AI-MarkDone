import { describe, expect, it } from 'vitest';
import { applyPromptToTriggerToken, findPromptTriggerToken } from '@/core/prompts/slashTrigger';

describe('prompt trigger helpers', () => {
    it('detects backslash prompt tokens at line starts and after whitespace', () => {
        expect(findPromptTriggerToken('\\', 1)).toEqual({ start: 0, end: 1, token: '\\', query: '' });
        expect(findPromptTriggerToken('Please \\re', 'Please \\re'.length)).toEqual({
            start: 7,
            end: 10,
            token: '\\re',
            query: 're',
        });
        expect(findPromptTriggerToken('First line\n\\sum', 'First line\n\\sum'.length)).toEqual({
            start: 11,
            end: 15,
            token: '\\sum',
            query: 'sum',
        });
    });

    it('ignores slash tokens and backslash tokens embedded inside regular words', () => {
        expect(findPromptTriggerToken('/re', '/re'.length)).toBeNull();
        expect(findPromptTriggerToken('hello\\re', 'hello\\re'.length)).toBeNull();
        expect(findPromptTriggerToken('Please \\re now', 'Please \\re now'.length)).toBeNull();
    });

    it('replaces only the current token and places the cursor at the marker', () => {
        const source = 'Before \\review after';
        const token = findPromptTriggerToken(source, 'Before \\review'.length)!;

        const result = applyPromptToTriggerToken(source, token, 'Review this:\n{{cursor}}\nThanks');

        expect(result.text).toBe('Before Review this:\n\nThanks after');
        expect(result.cursorIndex).toBe('Before Review this:\n'.length);
    });

    it('places the cursor at the inserted prompt end when no marker exists', () => {
        const source = '\\sum';
        const token = findPromptTriggerToken(source, source.length)!;

        const result = applyPromptToTriggerToken(source, token, 'Summarize this');

        expect(result.text).toBe('Summarize this');
        expect(result.cursorIndex).toBe('Summarize this'.length);
    });
});
