import { describe, expect, it, vi } from 'vitest';
import { ChatGPTCompactDirectoryRail } from '@/ui/content/chatgptDirectory/ChatGPTCompactDirectoryRail';
import type { ChatGPTConversationRound } from '@/drivers/content/chatgpt/types';

function makeRound(position: number): ChatGPTConversationRound {
    return {
        id: `r-${position}`,
        position,
        userPrompt: `Prompt ${position}`,
        assistantContent: '',
        preview: `Prompt ${position}`,
        messageId: `m-${position}`,
        userMessageId: null,
        assistantMessageId: `m-${position}`,
    };
}

describe('ChatGPTCompactDirectoryRail', () => {
    it('shows only one to four messages and opens one all-title popover from the rail', () => {
        const onSelect = vi.fn();
        const rail = new ChatGPTCompactDirectoryRail('light', onSelect);
        document.body.appendChild(rail.getElement());

        rail.setRounds([makeRound(1), makeRound(2), makeRound(3), makeRound(4)]);
        rail.setActivePosition(3);

        const root = rail.getElement().shadowRoot!;
        expect(root.querySelectorAll('.compact-rail__item')).toHaveLength(4);
        expect(root.querySelector<HTMLElement>('[data-position="3"]')?.dataset.active).toBe('1');
        expect(root.querySelector('style')?.textContent).not.toContain('scaleX');
        expect(root.querySelector('style')?.textContent).toContain('width: var(--aimd-space-5);');

        root.querySelector<HTMLElement>('.compact-rail')!.dispatchEvent(new Event('pointerenter', { bubbles: true }));

        const popover = document.getElementById('aimd-chatgpt-compact-directory-popover')!;
        const popoverCss = document.getElementById('aimd-chatgpt-compact-directory-popover-style')?.textContent ?? '';
        expect(popover.dataset.open).toBe('1');
        expect(Array.from(popover.querySelectorAll('.compact-popover__item')).map((item) => item.textContent)).toEqual([
            'Prompt 1',
            'Prompt 2',
            'Prompt 3',
            'Prompt 4',
        ]);
        expect(popover.querySelector<HTMLElement>('[data-position="3"]')?.dataset.active).toBe('1');
        expect(popoverCss).toContain('right: var(--aimd-space-5);');
        expect(popoverCss).toContain('padding: var(--aimd-space-1) var(--aimd-space-3);');
        expect(popoverCss).toContain('font-size: var(--aimd-text-sm);');

        root.querySelector<HTMLElement>('.compact-rail')!.dispatchEvent(new Event('pointerleave', { bubbles: true }));
        expect(popover.dataset.open).toBe('1');
        popover.dispatchEvent(new Event('pointerenter', { bubbles: true }));
        expect(popover.dataset.open).toBe('1');

        popover.querySelector<HTMLButtonElement>('[data-position="2"]')!.click();
        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ position: 2 }));
        expect(popover.dataset.open).toBe('0');

        rail.setRounds([makeRound(1), makeRound(2), makeRound(3), makeRound(4), makeRound(5)]);

        expect(root.querySelectorAll('.compact-rail__item')).toHaveLength(0);
        expect(rail.getElement().dataset.empty).toBe('1');
        rail.dispose();
    });
});
