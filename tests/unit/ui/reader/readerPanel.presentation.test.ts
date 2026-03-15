import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

describe('ReaderPanel presentation', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('renders the mock-based reader shell with static header meta and conversation sections', async () => {
        const panel = new ReaderPanel();
        const longPrompt = '1234567890123456789012345678901234567890-extra prompt';

        try {
            await panel.show([{ id: 'a', userPrompt: longPrompt, content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const backdropRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-backdrop-root"]');
            const surfaceRoot = shadow.querySelector<HTMLElement>('[data-role="overlay-surface-root"]');
            const panelWindow = shadow.querySelector<HTMLElement>('.panel-window.panel-window--reader');
            const headerMeta = shadow.querySelector<HTMLElement>('.panel-window--reader .panel-header__meta--reader');
            const headerTitle = shadow.querySelector<HTMLElement>('.panel-window--reader .panel-header__meta h2');
            const pageCounter = shadow.querySelector<HTMLElement>('.panel-window--reader .reader-header-page');
            const userSection = shadow.querySelector<HTMLElement>('.reader-message--user');
            const assistantSection = shadow.querySelector<HTMLElement>('.reader-message--assistant');
            const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown');
            const hint = shadow.querySelector<HTMLElement>('.reader-footer__meta .hint');
            const katexLink = shadow.querySelector<HTMLLinkElement>('link[data-aimd-style-link="aimd-reader-panel-katex"]');
            const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/ReaderPanel.ts'), 'utf8');

            expect(backdropRoot?.querySelector('.panel-stage__overlay')).toBeTruthy();
            expect(surfaceRoot).toBeTruthy();
            expect(panelWindow).toBeTruthy();
            expect(headerMeta).toBeTruthy();
            expect(headerTitle?.textContent).toBeTruthy();
            expect(pageCounter?.textContent).toBe('1/1');
            expect(userSection?.textContent).toContain('User');
            expect(userSection?.textContent).toContain(longPrompt);
            expect(assistantSection?.textContent).toContain('AI');
            expect(markdownRoot?.textContent).toContain('md1');
            expect(hint?.textContent).toBe('');
            expect(source).toContain("tailwind-overlay.css?inline");
            expect(katexLink?.rel).toBe('stylesheet');
        } finally {
            panel.hide();
        }
    });

    it('shows a delayed shared preview tooltip when hovering a pager dot', async () => {
        vi.useFakeTimers();
        const panel = new ReaderPanel();

        try {
            await panel.show(
                [
                    { id: 'a', userPrompt: 'First prompt preview', content: 'md1' },
                    { id: 'b', userPrompt: 'Second prompt preview', content: 'md2' },
                ],
                0,
                'light'
            );

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const secondDot = shadow.querySelectorAll<HTMLButtonElement>('.reader-dots .reader-dot')[1]!;

            secondDot.dispatchEvent(new Event('pointerover', { bubbles: true }));
            vi.advanceTimersByTime(180);

            const tooltip = shadow.querySelector<HTMLElement>('.aimd-tooltip[data-variant="preview"]');
            expect(tooltip).toBeTruthy();
            expect(tooltip?.textContent).toContain('2');
            expect(tooltip?.textContent).toContain('Second prompt preview');
            expect(shadow.querySelector('style[data-aimd-tooltip-style="1"]')).toBeTruthy();

            secondDot.dispatchEvent(new Event('pointerout', { bubbles: true }));
            expect(shadow.querySelector('.aimd-tooltip')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('lets the caller hide the open-conversation header control for message-entry reader mode', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                showOpenConversation: false,
            } as any);

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            expect(shadow.querySelector('[data-action="reader-open-conversation"]')).toBeNull();
        } finally {
            panel.hide();
        }
    });
});
