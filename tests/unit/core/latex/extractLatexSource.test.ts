import { describe, expect, it } from 'vitest';
import { extractLatexSource } from '@/core/latex/extractLatexSource';

describe('extractLatexSource', () => {
    it('extracts from data-latex-source on self', () => {
        const el = document.createElement('span');
        el.setAttribute('data-latex-source', 'x_1 + y');
        expect(extractLatexSource(el)).toBe('x_1 + y');
    });

    it('extracts from closest ancestor attributes', () => {
        const parent = document.createElement('div');
        parent.setAttribute('data-math', '\\frac{1}{2}');
        const child = document.createElement('span');
        parent.appendChild(child);
        expect(extractLatexSource(child)).toBe('\\frac{1}{2}');
    });

    it('extracts from KaTeX annotation', () => {
        const el = document.createElement('span');
        el.innerHTML = '<annotation encoding="application/x-tex">E=mc^2</annotation>';
        expect(extractLatexSource(el)).toBe('E=mc^2');
    });

    it('extracts from katex-error text', () => {
        const el = document.createElement('span');
        el.className = 'katex-error';
        el.textContent = '\\alpha_1';
        expect(extractLatexSource(el)).toBe('\\alpha_1');
    });
});

