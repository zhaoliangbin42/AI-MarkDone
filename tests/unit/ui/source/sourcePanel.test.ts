import fs from 'node:fs';
import path from 'node:path';
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
        expect(shadow.querySelector('[data-role="overlay-backdrop-root"] .panel-stage__overlay')).toBeTruthy();
        expect(shadow.querySelector('[data-role="overlay-surface-root"] .panel-window.panel-window--source')).toBeTruthy();
        expect(shadow.querySelector('.panel-window--source .panel-header__meta--reader h2')?.textContent).toBe('Source');
        expect(shadow.querySelector('[data-action="source-copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="close-panel"]')).toBeTruthy();
        expect(shadow.querySelector('.panel-window--source .source-pre')?.textContent).toBe('RAW');
        expect(shadow.querySelector('.panel-window--source .panel-footer')).toBeNull();

        const sourceText = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/source/SourcePanel.ts'), 'utf8');
        expect(sourceText).toContain('tailwind-overlay.css?inline');

        // Should not include Reader navigation/dots/source toggle UI.
        expect(shadow.querySelector('[data-role="dots"]')).toBeNull();
        expect(shadow.querySelector('[data-action="prev"]')).toBeNull();
        expect(shadow.querySelector('[data-action="next"]')).toBeNull();
        expect(shadow.querySelector('[data-action="source"]')).toBeNull();

        shadow.querySelector<HTMLButtonElement>('[data-action="source-copy"]')!.click();
        expect(copyTextToClipboard).toHaveBeenCalledWith('RAW');

        shadow.querySelector<HTMLButtonElement>('[data-action="close-panel"]')!.click();
        expect(document.getElementById('aimd-source-panel-host')).toBeNull();
    });
});
