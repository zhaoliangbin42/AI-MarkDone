import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/drivers/content/clipboard/clipboard', () => ({
    copyTextToClipboard: vi.fn(async () => true),
}));

import { copyTextToClipboard } from '../../../../src/drivers/content/clipboard/clipboard';
import { SourcePanel } from '../../../../src/ui/content/source/SourcePanel';

describe('SourcePanel', () => {
    it('shows raw content and only exposes copy/close controls', async () => {
        const panel = new SourcePanel();
        panel.show({ theme: 'light', title: 'T', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host');
        expect(host).toBeTruthy();

        const shadow = host!.shadowRoot!;
        expect(shadow.querySelector('[data-action="copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="close"]')).toBeTruthy();
        expect(shadow.querySelector('[data-role="content"]')?.textContent).toBe('RAW');
        const styles = shadow.querySelector('style')?.textContent ?? '';
        expect(styles).toContain('font-family: var(--aimd-font-family-sans);');
        expect(styles).toContain('.pre {');
        expect(styles).toContain('font-family: var(--aimd-font-family-mono);');

        // Should not include Reader navigation/dots/source toggle UI.
        expect(shadow.querySelector('[data-role="dots"]')).toBeNull();
        expect(shadow.querySelector('[data-action="prev"]')).toBeNull();
        expect(shadow.querySelector('[data-action="next"]')).toBeNull();
        expect(shadow.querySelector('[data-action="source"]')).toBeNull();

        shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!.click();
        expect(copyTextToClipboard).toHaveBeenCalledWith('RAW');

        shadow.querySelector<HTMLButtonElement>('[data-action="close"]')!.click();
        expect(document.getElementById('aimd-source-panel-host')).toBeNull();
    });
});
