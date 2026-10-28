import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { richSvgBlock } from '../../helpers/richContentFixtures';

afterEach(() => { document.querySelector('#aimd-reader-panel-host')?.remove(); });

describe('Reader rich content lifecycle', () => {
    it('does not acquire images when disabled, and preserves surrounding text across a settings toggle', async () => {
        const panel = new ReaderPanel();
        const release = vi.fn();
        const resolveRichContent = vi.fn(async () => ({ assets: [{ blockId: 'block-1', url: `blob:${location.origin}/reader-opt-in`, mimeType: 'image/png' as const }], release }));
        panel.setReaderSettings({ ...DEFAULT_SETTINGS.reader, showImagesInReader: false });
        await panel.show([{ id: 'rich', userPrompt: '', content: 'Before.\n\n![Diagram](aimd-rich:block-1)\n\nAfter.', richBlocks: [richSvgBlock()] }], 0, 'light', { resolveRichContent });
        const shadow = document.querySelector('#aimd-reader-panel-host')!.shadowRoot!;
        expect(resolveRichContent).not.toHaveBeenCalled();
        expect(shadow.querySelector('.reader-markdown img')).toBeNull();
        expect(shadow.querySelector('.reader-markdown')?.textContent).toContain('Before.');
        expect(shadow.querySelector('.reader-markdown')?.textContent).toContain('After.');
        panel.setReaderSettings({ ...DEFAULT_SETTINGS.reader, showImagesInReader: true });
        await vi.waitFor(() => expect(shadow.querySelector('.reader-markdown img')).toBeTruthy());
        panel.setReaderSettings({ ...DEFAULT_SETTINGS.reader, showImagesInReader: false });
        await vi.waitFor(() => expect(shadow.querySelector('.reader-markdown img')).toBeNull());
        expect(release).toHaveBeenCalledTimes(1);
        panel.hide();
    });

    it('keeps a placeholder after a static image fails to decode, including later layout renders', async () => {
        const panel = new ReaderPanel();
        const release = vi.fn();
        await panel.show([{ id: 'rich', userPrompt: '', content: '![Diagram](aimd-rich:block-1)', richBlocks: [richSvgBlock()] }], 0, 'light', {
            resolveRichContent: async () => ({ assets: [{ blockId: 'block-1', url: `blob:${location.origin}/unavailable-image`, mimeType: 'image/png' as const }], release }),
        });
        const shadow = document.querySelector('#aimd-reader-panel-host')!.shadowRoot!;
        await vi.waitFor(() => expect(shadow.querySelector('.reader-markdown img')).toBeTruthy());
        shadow.querySelector('.reader-markdown img')!.dispatchEvent(new Event('error'));
        expect(shadow.querySelector('.reader-markdown img')).toBeNull();
        expect(shadow.querySelector('.reader-markdown')?.textContent).toContain('[Diagram]');
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-fullscreen"]')!.click();
        expect(shadow.querySelector('.reader-markdown img')).toBeNull();
        panel.hide();
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('renders text immediately then hydrates only the rich slot and releases it on item change', async () => {
        const panel = new ReaderPanel();
        let complete!: (value: unknown) => void;
        let signal!: AbortSignal;
        const release = vi.fn();
        const resolveRichContent = vi.fn((_item, nextSignal) => { signal = nextSignal; return new Promise(resolve => { complete = resolve; }); });
        await panel.show([
            { id: 'rich', userPrompt: '', content: 'Before.\n\n![Diagram](aimd-rich:block-1)\n\nAfter.', richBlocks: [richSvgBlock()] },
            { id: 'plain', userPrompt: '', content: 'Next item.' },
        ], 0, 'light', { resolveRichContent });
        const shadow = document.querySelector('#aimd-reader-panel-host')!.shadowRoot!;
        const before = shadow.querySelector('.reader-markdown p')!;
        before.setAttribute('data-test-annotation', 'kept');
        expect(shadow.querySelector('[data-aimd-rich-block="block-1"]')).toBeTruthy();
        expect(shadow.querySelector('.reader-markdown img')).toBeNull();
        complete({ assets: [{ blockId: 'block-1', url: `blob:${location.origin}/reader-test`, mimeType: 'image/png' }], release });
        await vi.waitFor(() => expect(shadow.querySelector('.reader-markdown img')).toBeTruthy());
        expect(before.isConnected).toBe(true);
        expect(before.getAttribute('data-test-annotation')).toBe('kept');
        expect(release).not.toHaveBeenCalled();
        shadow.querySelector<HTMLButtonElement>('[data-action="reader-next"]')!.click();
        await vi.waitFor(() => expect(shadow.querySelector('.reader-markdown')?.textContent).toContain('Next item.'));
        expect(signal.aborted).toBe(true);
        expect(release).toHaveBeenCalledTimes(1);
        panel.hide();
    });

    it('releases a late asset result after Reader closes without repainting its content', async () => {
        const panel = new ReaderPanel();
        let complete!: (value: unknown) => void;
        const release = vi.fn();
        const resolver = vi.fn(() => new Promise(resolve => { complete = resolve; }));
        await panel.show([{ id: 'rich', userPrompt: '', content: '![Diagram](aimd-rich:block-1)', richBlocks: [richSvgBlock()] }], 0, 'light', { resolveRichContent: resolver });
        panel.hide();
        complete({ assets: [{ blockId: 'block-1', url: `blob:${location.origin}/reader-late`, mimeType: 'image/png' }], release });
        await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
        expect(document.querySelector('#aimd-reader-panel-host')?.shadowRoot?.querySelector('img')).toBeFalsy();
    });
});
