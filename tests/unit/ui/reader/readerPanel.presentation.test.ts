import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';

async function flushMotionFrames(): Promise<void> {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

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
            const footerPage = shadow.querySelector<HTMLElement>('.reader-footer__meta .reader-footer-page');
            const katexLink = shadow.querySelector<HTMLLinkElement>('link[data-aimd-style-link="aimd-reader-panel-katex"]');
            const readerSource = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/ReaderPanel.ts'), 'utf8');
            const templateSource = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

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
            expect(footerPage?.textContent).toBe('1/1');
            expect(readerSource).toContain('OverlaySession');
            expect(readerSource).not.toContain('mountOverlaySurfaceHost');
            expect(templateSource).toContain('getPanelChromeCss()');
            expect(templateSource).toContain('.panel-window--reader {');
            expect(templateSource).not.toContain('top: var(--aimd-panel-top);');
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

    it('uses the conversation-reader profile to hide the open-conversation header control', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                profile: 'conversation-reader',
            });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            expect(shadow.querySelector('[data-action="reader-open-conversation"]')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('keeps the reader panel mounted in a closing state until the panel animation ends', async () => {
        const panel = new ReaderPanel();

        await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');

        const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
        const shadow = host.shadowRoot as ShadowRoot;
        const shell = shadow.querySelector<HTMLElement>('.panel-window--reader');

        panel.hide();

        expect(document.querySelector('#aimd-reader-panel-host')).toBeTruthy();
        expect(shell?.dataset.motionState).toBe('closing');

        shell?.dispatchEvent(new Event('animationend', { bubbles: true }));
        await Promise.resolve();

        expect(document.querySelector('#aimd-reader-panel-host')).toBeNull();
    });

    it('does not render the open-conversation header control when no callback or conversation url is available', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1', meta: { url: '   ' } as any }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            expect(shadow.querySelector('[data-action="reader-open-conversation"]')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('uses the bookmark-preview profile to keep the open-conversation header control available', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                profile: 'bookmark-preview',
                onOpenConversation: async () => undefined,
            });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;

            expect(shadow.querySelector('[data-action="reader-open-conversation"]')).toBeTruthy();
        } finally {
            panel.hide();
        }
    });

    it('keeps the tokenized markdown theme as the only shipped reader body styling', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: '# Title\\n\\n```ts\\nconst x = 1;\\n```' }], 0, 'dark', {
                profile: 'conversation-reader',
            });

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown.markdown-body');
            const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');

            expect(markdownRoot).toBeTruthy();
            expect(styleText).toContain('var(--aimd-text-primary)');
            expect(styleText).not.toContain('#478be6');
            expect(styleText).not.toContain('github-markdown');
            expect(shadow.querySelector('.reader-footer__left')).toBeTruthy();
        } finally {
            panel.hide();
        }
    });

    it('uses a configured reader content width while keeping the panel-width clamp', async () => {
        const panel = new ReaderPanel();
        panel.setContentMaxWidthPx(1280);

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = (host as any).shadowRoot as ShadowRoot;
            const content = shadow.querySelector<HTMLElement>('.reader-content');
            const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');

            expect(content?.style.getPropertyValue('--_reader-content-max-width')).toBe('1280px');
            expect(styleText).toContain('max-width: min(var(--_reader-content-max-width, 1000px), 100%);');
        } finally {
            panel.hide();
        }
    });

    it('keeps the same shell mounted through async content rendering and promotes it to open after the entering frames', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const panelWindow = shadow.querySelector<HTMLElement>('.panel-window--reader');
            const backdrop = shadow.querySelector<HTMLElement>('.panel-stage__overlay');

            expect(panelWindow).toBeTruthy();
            expect(backdrop).toBeTruthy();

            await flushMotionFrames();

            expect(shadow.querySelector<HTMLElement>('.panel-window--reader')).toBe(panelWindow);
            expect(shadow.querySelector<HTMLElement>('.panel-stage__overlay')).toBe(backdrop);
            expect(panelWindow?.dataset.motionState).toBe('open');
            expect(backdrop?.dataset.motionState).toBe('open');
        } finally {
            panel.hide();
        }
    });

    it('keeps active icon buttons visually selected on hover and gives pagination dots hover affordances', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

        expect(source).toContain('.icon-btn--active:hover');
        expect(source).toContain('.reader-dot:hover');
        expect(source).toContain('.reader-dot:focus-visible');
        expect(source).toContain('.reader-dot:active');
        expect(source).toContain('.reader-ellipsis {');
        expect(source).toContain('.reader-ellipsis__dot');
    });

    it('uses shared panel title and body typography tokens instead of local raw reader sizes', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

        expect(source).not.toContain('--aimd-panel-title-size: var(--aimd-panel-title-size-compact);');
        expect(source).toContain('.reader-message__body--prompt {');
        expect(source).toContain('.reader-message__body--prompt-truncated {');
        expect(source).toContain('.reader-message__ellipsis-line {');
        expect(source).toContain('font-size: var(--aimd-text-base);');
        expect(source).toContain('line-height: var(--aimd-leading-reading);');
        expect(source).not.toContain('font-size: 17px;');
    });

    it('keeps atomic reader selection styles local, token-driven, and lightly rounded', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

        expect(source).toContain('[data-aimd-unit-state="selected"]');
        expect(source).toContain('--_reader-atomic-selected-bg');
        expect(source).toContain('var(--aimd-interactive-selected)');
        expect(source).toContain('.reader-markdown :where([data-aimd-unit-state="selected"]) {');
        expect(source).toContain('border-radius: var(--aimd-radius-sm);');
        expect(source).not.toContain('.reader-markdown :where([data-aimd-unit-state="selected"]) {\n  border-radius: 0;');
    });

    it('keeps floating reader comment controls shadow-free and on their own hover token path', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

        expect(source).toContain('--_reader-comment-floating-hover-bg');
        expect(source).toContain('--_reader-comment-floating-active-bg');
        expect(source).toContain('.reader-comment-action {');
        expect(source).toContain('.reader-comment-anchor {');
        expect(source).not.toContain('box-shadow: var(--aimd-shadow-sm);');
        expect(source).toContain('.reader-comment-action__button:hover,');
        expect(source).toContain('.reader-comment-anchor:hover {');
        expect(source).not.toContain('.reader-comment-action__button:hover,\n.reader-comment-action__button:active {\n  color: var(--aimd-interactive-primary);\n}');
    });

    it('renders selection actions as floating controls instead of clipping them inside the markdown shell', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

        expect(source).toContain('.reader-comment-action {');
        expect(source).toContain('position: absolute;');
        expect(source).toContain('.reader-comment-anchor {');
        expect(source).toContain('position: absolute;');
    });
});
