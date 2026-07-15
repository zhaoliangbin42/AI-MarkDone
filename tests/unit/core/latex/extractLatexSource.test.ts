import { describe, expect, it } from 'vitest';
import {
    extractAuthoritativeLatexSource,
    extractLatexSource,
} from '@/core/latex/extractLatexSource';

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

    it('extracts from common platform formula attributes', () => {
        for (const [attribute, value] of [
            ['data-latex', '\\alpha_1'],
            ['data-tex', '\\beta_2'],
            ['data-original-tex', '\\gamma_3'],
        ] as const) {
            const el = document.createElement('span');
            el.setAttribute(attribute, value);
            expect(extractLatexSource(el)).toBe(value);
        }
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

    it('uses accessible labels only when they look like LaTeX', () => {
        const latex = document.createElement('mjx-container');
        latex.setAttribute('aria-label', '\\sqrt{x}');
        expect(extractLatexSource(latex)).toBe('\\sqrt{x}');

        const plain = document.createElement('mjx-container');
        plain.setAttribute('aria-label', 'square root of x');
        expect(extractLatexSource(plain)).toBeNull();
    });

    it('marks only source attributes and TeX annotations as authoritative', () => {
        const dataSource = document.createElement('span');
        dataSource.setAttribute('data-math', String.raw`\frac{1}{2}`);
        expect(extractAuthoritativeLatexSource(dataSource)).toBe(String.raw`\frac{1}{2}`);

        const annotation = document.createElement('span');
        annotation.innerHTML = '<annotation encoding="application/x-tex">x_1+y</annotation>';
        expect(extractAuthoritativeLatexSource(annotation)).toBe('x_1+y');

        const heuristic = document.createElement('span');
        heuristic.className = 'katex-error';
        heuristic.textContent = String.raw`\unknown{x}`;
        expect(extractAuthoritativeLatexSource(heuristic)).toBeNull();

        const accessible = document.createElement('mjx-container');
        accessible.setAttribute('aria-label', String.raw`\sqrt{x}`);
        expect(extractAuthoritativeLatexSource(accessible)).toBeNull();
    });
});
