import { afterEach, describe, expect, it } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel user prompt truncation', () => {
    afterEach(() => {
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('renders long user prompts as head, middle, tail excerpts with standalone ellipsis lines', async () => {
        const panel = new ReaderPanel();
        const prompt = 'A'.repeat(200) + 'B'.repeat(300) + 'C'.repeat(200) + 'D'.repeat(300);

        try {
            await panel.show([{ id: 'a', userPrompt: prompt, content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const promptSegments = Array.from(
                shadow.querySelectorAll<HTMLElement>('.reader-message__body--prompt [data-role="user-prompt-segment"]')
            );
            const ellipsisLines = Array.from(
                shadow.querySelectorAll<HTMLElement>('.reader-message__body--prompt [data-role="user-prompt-ellipsis"]')
            );
            const tooltipDot = shadow.querySelector<HTMLButtonElement>('.reader-dots .reader-dot');

            expect(promptSegments).toHaveLength(3);
            expect(promptSegments[0]?.textContent).toBe(prompt.slice(0, 200));
            expect(promptSegments[1]?.textContent).toBe(prompt.slice(400, 600));
            expect(promptSegments[2]?.textContent).toBe(prompt.slice(-200));
            expect(ellipsisLines).toHaveLength(2);
            expect(ellipsisLines[0]?.textContent).toBe('...');
            expect(ellipsisLines[1]?.textContent).toBe('...');
            expect(tooltipDot?.dataset.tooltip).toBe(prompt);
        } finally {
            panel.hide();
        }
    });
});
