import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/drivers/content/clipboard/clipboard', () => ({
    copyTextToClipboard: vi.fn(async () => true),
}));

import { copyTextToClipboard } from '../../../../src/drivers/content/clipboard/clipboard';
import { setLocale } from '../../../../src/ui/content/components/i18n';
import { SourcePanel } from '../../../../src/ui/content/source/SourcePanel';

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function flushUi(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe('SourcePanel', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.innerHTML = '';
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: any) => {
                const target = String(url);
                if (target.includes('_locales/zh_CN/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('zh_CN') } as any;
                }
                if (target.includes('_locales/en/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('en') } as any;
                }
                return { ok: false, json: async () => ({}) } as any;
            }),
        );
    });

    afterEach(async () => {
        document.body.innerHTML = '';
        await setLocale('en');
        vi.unstubAllGlobals();
    });

    it('shows raw content and only exposes copy/close controls', async () => {
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', title: 'T', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host');
        expect(host).toBeTruthy();

        const shadow = host!.shadowRoot!;
        const styles = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent || '').join('\n');
        expect(shadow.querySelector('[data-role="overlay-backdrop-root"] .panel-stage__overlay')).toBeTruthy();
        expect(shadow.querySelector('[data-role="overlay-surface-root"] .panel-window.panel-window--source')).toBeTruthy();
        expect(shadow.querySelector('.panel-window--source .panel-header__meta--reader h2')?.textContent).toBe('T');
        expect(shadow.querySelector('[data-action="source-copy"]')).toBeTruthy();
        expect(shadow.querySelector('[data-action="close-panel"]')).toBeTruthy();
        expect(shadow.querySelector('.panel-window--source .source-pre')?.textContent).toBe('RAW');
        expect(shadow.querySelector('.panel-window--source .panel-footer')).toBeNull();
        expect(styles).toContain('.panel-window--source {');
        expect(styles).toContain('height: min(var(--aimd-panel-height), calc(100vh - var(--aimd-space-6)));');
        expect(styles).toContain('max-height: calc(100vh - var(--aimd-space-6));');

        const sourceText = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/source/SourcePanel.ts'), 'utf8');
        expect(sourceText).toContain('OverlaySession');
        expect(sourceText).not.toContain('mountOverlaySurfaceHost');

        // Should not include Reader navigation/dots/source toggle UI.
        expect(shadow.querySelector('[data-role="dots"]')).toBeNull();
        expect(shadow.querySelector('[data-action="prev"]')).toBeNull();
        expect(shadow.querySelector('[data-action="next"]')).toBeNull();
        expect(shadow.querySelector('[data-action="source"]')).toBeNull();

        shadow.querySelector<HTMLButtonElement>('[data-action="source-copy"]')!.click();
        await flushUi();
        expect(copyTextToClipboard).toHaveBeenCalledWith('RAW');
        expect(shadow.querySelector('.aimd-tooltip[data-variant="ephemeral"]')?.textContent).toContain('Copied');

        shadow.querySelector<HTMLButtonElement>('[data-action="close-panel"]')!.click();
        const shell = shadow.querySelector<HTMLElement>('.panel-window--source');
        expect(shell?.dataset.motionState).toBe('closing');
        shell?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.getElementById('aimd-source-panel-host')).toBeNull();
    });

    it('renders a provided custom title and preserves it across locale changes', async () => {
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', title: 'Custom Title', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        expect(shadow.querySelector('.panel-window--source .panel-header__meta--reader h2')?.textContent).toBe('Custom Title');

        await setLocale('zh_CN');
        await flushUi();

        expect(shadow.querySelector('.panel-window--source .panel-header__meta--reader h2')?.textContent).toBe('Custom Title');
    });

    it('updates visible copy when the locale changes while open', async () => {
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;

        expect(shadow.querySelector('.panel-window--source .panel-header__meta--reader h2')?.textContent).toBe('Markdown Source Code');
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="source-copy"]')?.getAttribute('aria-label')).toBe('Copy');

        await setLocale('zh_CN');
        await flushUi();

        expect(shadow.querySelector('.panel-window--source .panel-header__meta--reader h2')?.textContent).toBe('Markdown 源码');
        expect(shadow.querySelector<HTMLButtonElement>('[data-action="source-copy"]')?.getAttribute('aria-label')).toBe('复制');
    });

    it('shows failure feedback when source copy fails', async () => {
        vi.mocked(copyTextToClipboard).mockResolvedValueOnce(false);
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host');
        const shadow = host!.shadowRoot!;

        shadow.querySelector<HTMLButtonElement>('[data-action="source-copy"]')!.click();
        await flushUi();

        expect(shadow.querySelector('.aimd-tooltip[data-variant="ephemeral"]')?.textContent).toContain('Copy failed');
    });

    it('stops reacting to locale changes after hide', async () => {
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', content: 'RAW' });

        expect(document.getElementById('aimd-source-panel-host')).toBeTruthy();

        panel.hide();
        const host = document.getElementById('aimd-source-panel-host');
        const shell = host?.shadowRoot?.querySelector<HTMLElement>('.panel-window--source');
        expect(host).toBeTruthy();
        expect(shell?.dataset.motionState).toBe('closing');
        shell?.dispatchEvent(new Event('animationend', { bubbles: true }));
        expect(document.getElementById('aimd-source-panel-host')).toBeNull();

        await setLocale('zh_CN');
        await flushUi();

        expect(document.getElementById('aimd-source-panel-host')).toBeNull();
    });

    it('keeps the source panel mounted in a closing state until the animation ends', async () => {
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host');
        expect(host).toBeTruthy();
        const shadow = host!.shadowRoot!;
        const shell = shadow.querySelector<HTMLElement>('.panel-window--source')!;

        panel.hide();

        expect(document.getElementById('aimd-source-panel-host')).toBeTruthy();
        expect(shell.dataset.motionState).toBe('closing');

        shell.dispatchEvent(new Event('animationend', { bubbles: true }));
        await flushUi();
        expect(document.getElementById('aimd-source-panel-host')).toBeNull();
    });

    it('does not close when text selection starts inside the panel and releases on the backdrop', async () => {
        await setLocale('en');
        const panel = new SourcePanel();
        panel.show({ theme: 'light', content: 'RAW' });

        const host = document.getElementById('aimd-source-panel-host')!;
        const shadow = host.shadowRoot!;
        const shell = shadow.querySelector<HTMLElement>('.panel-window--source')!;
        const backdrop = shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"] .panel-stage__overlay')!;

        shell.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(document.getElementById('aimd-source-panel-host')).toBeTruthy();
        expect(shell.dataset.motionState).not.toBe('closing');

        backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(shell.dataset.motionState).toBe('closing');
    });

});
