import { describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

function setClipboardMock() {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
    });
    return { writeText };
}

describe('ReaderPanel (MVP)', () => {
    it('shows, paginates, and copies current page markdown', async () => {
        const { writeText } = setClipboardMock();

        const panel = new ReaderPanel();
        await panel.show(
            [
                { id: 'a', userPrompt: 'Q1', content: 'md1' },
                { id: 'b', userPrompt: 'Q2', content: 'md2' },
            ],
            0,
            'light'
        );

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        expect(host).toBeTruthy();
        const shadow = (host as any).shadowRoot as ShadowRoot;
        expect(shadow).toBeTruthy();

        const copyBtn = shadow.querySelector<HTMLButtonElement>('[data-action="copy"]');
        expect(copyBtn).toBeTruthy();
        copyBtn!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledWith('md1');

        const nextBtn = shadow.querySelector<HTMLButtonElement>('[data-action="next"]')!;
        nextBtn.click();
        await Promise.resolve();

        copyBtn!.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(writeText).toHaveBeenCalledWith('md2');

        panel.hide();
        expect(document.querySelector('#aimd-reader-panel-host')).toBeNull();
    });

    it('toggles between standard and fullscreen reader layouts', async () => {
        const panel = new ReaderPanel();
        await panel.show([{ id: 'a', userPrompt: 'Q1', content: 'md1' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = (host as any).shadowRoot as ShadowRoot;
        const panelEl = shadow.querySelector<HTMLElement>('.panel')!;
        const fullscreenBtn = shadow.querySelector<HTMLButtonElement>('[data-action="fullscreen"]')!;

        expect(panelEl.dataset.fullscreen).toBe('0');
        expect(fullscreenBtn.title).toBeTruthy();
        const styles = shadow.querySelector('style')?.textContent ?? '';
        expect(styles).toContain('max-width: 1000px');

        fullscreenBtn.click();
        expect(panelEl.dataset.fullscreen).toBe('1');

        fullscreenBtn.click();
        expect(panelEl.dataset.fullscreen).toBe('0');

        panel.hide();
    });
});
