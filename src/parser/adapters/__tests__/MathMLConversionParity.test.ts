import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { ChatGPTAdapter } from '@/parser/adapters/ChatGPTAdapter';
import { ClaudeAdapter } from '@/parser/adapters/ClaudeAdapter';

function extractWithAdapters(mathInner: string): { chatgpt: string | null; claude: string | null } {
    const html = `
        <span class="katex">
            <math>${mathInner}</math>
        </span>
    `;
    const dom = new JSDOM(html);
    const node = dom.window.document.querySelector('.katex') as HTMLElement;

    const chatgpt = new ChatGPTAdapter().extractLatex(node)?.latex ?? null;
    const claude = new ClaudeAdapter().extractLatex(node)?.latex ?? null;
    return { chatgpt, claude };
}

describe('MathML conversion parity', () => {
    it('keeps mfrac conversion aligned', () => {
        const result = extractWithAdapters('<mfrac><mi>a</mi><mi>b</mi></mfrac>');
        expect(result.chatgpt).toBe('\\frac{a}{b}');
        expect(result.claude).toBe('\\frac{a}{b}');
    });

    it('keeps msub and msup conversion aligned', () => {
        const sub = extractWithAdapters('<msub><mi>x</mi><mi>1</mi></msub>');
        const sup = extractWithAdapters('<msup><mi>x</mi><mi>2</mi></msup>');

        expect(sub.chatgpt).toBe('{x}_{1}');
        expect(sub.claude).toBe('{x}_{1}');
        expect(sup.chatgpt).toBe('{x}^{2}');
        expect(sup.claude).toBe('{x}^{2}');
    });
});
