import { beforeEach, describe, expect, it } from 'vitest';

import { readChatGPTOfficialNavigation } from '@/drivers/content/chatgpt/ChatGPTOfficialNavigation';

describe('ChatGPT official conversation navigation discovery', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <main>
                <div class="qMYqUG_convSearchResultHighlightRoot">
                    <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2">
                        <button aria-label="Prompt 1"></button>
                        <button aria-label="Prompt 2"></button>
                        <button aria-label="Prompt 3"></button>
                    </div>
                </div>
            </main>
        `;
    });

    it('reads the official navigation skeleton without depending on prompt labels', () => {
        expect(readChatGPTOfficialNavigation()).toMatchObject({
            ready: true,
            expectedTurnCount: 3,
        });
    });

    it('detects the structural navigation even when its CSS hides it', () => {
        const fixed = document.querySelector<HTMLElement>('.fixed');
        if (!fixed) throw new Error('fixed navigation fixture is missing');
        fixed.style.display = 'none';

        expect(readChatGPTOfficialNavigation()).toMatchObject({
            ready: true,
            expectedTurnCount: 3,
        });
    });

    it('fails closed when the host navigation is absent', () => {
        document.body.innerHTML = '<main></main>';

        expect(readChatGPTOfficialNavigation()).toEqual({
            ready: false,
            expectedTurnCount: 0,
        });
    });
});
