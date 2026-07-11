import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/drivers/shared/clients/bookmarksClient', () => ({
    bookmarksClient: {
        getChangelogNotice: vi.fn(async () => ({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: null,
                reason: null,
                previousVersion: null,
            },
        })),
        ackChangelogNotice: vi.fn(async () => ({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: '4.4.1',
                reason: null,
                previousVersion: '4.3.1',
            },
        })),
    },
}));

vi.mock('@/drivers/content/export/katexAssets', () => ({
    hasKatexMarkup: (html: string) => /\bkatex\b/.test(html || ''),
    getKatexCssWithRuntimeFontUrls: vi.fn(async () => ({
        mode: 'runtime-url',
        css: '@font-face{font-family:KaTeX_Main;src:url("chrome-extension://mock/vendor/katex/fonts/KaTeX_Main-Regular.woff2")}.katex{font-family:KaTeX_Main}.katex-display{display:block}',
    })),
    getKatexRuntimeFontFaceCss: vi.fn(async () => '@font-face{font-family:KaTeX_Main;src:url("chrome-extension://mock/vendor/katex/fonts/KaTeX_Main-Regular.woff2")}'),
}));

import { ReaderPanel } from '@/ui/content/reader/ReaderPanel';
import { bookmarksClient } from '@/drivers/shared/clients/bookmarksClient';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { getKatexCssWithRuntimeFontUrls, getKatexRuntimeFontFaceCss } from '@/drivers/content/export/katexAssets';
import { clearReaderCommentScope, saveReaderComment } from '@/services/reader/commentSession';

async function flushMotionFrames(): Promise<void> {
    await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

describe('ReaderPanel presentation', () => {
    beforeEach(() => {
        vi.mocked(bookmarksClient.getChangelogNotice).mockResolvedValue({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: null,
                reason: null,
                previousVersion: null,
            },
        } as any);
        vi.mocked(bookmarksClient.ackChangelogNotice).mockResolvedValue({
            ok: true,
            data: {
                pendingVersion: null,
                lastShownVersion: '4.4.1',
                reason: null,
                previousVersion: '4.3.1',
            },
        } as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        clearReaderCommentScope('reader-panel-comments-v1');
        document.querySelector('#aimd-reader-panel-host')?.remove();
    });

    it('shows and acknowledges the shared changelog notice when opening reader with a pending version', async () => {
        vi.mocked(bookmarksClient.getChangelogNotice).mockResolvedValueOnce({
            ok: true,
            data: {
                pendingVersion: '4.8.1',
                lastShownVersion: null,
                reason: 'update',
                previousVersion: '4.4.6',
            },
        } as any);
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                profile: 'conversation-reader',
            });
            await Promise.resolve();

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const modal = shadow.querySelector<HTMLElement>('.mock-modal');

            expect(modal?.querySelector('.mock-modal__title-copy strong')?.textContent).toBe("What's new in AI-MarkDone 4.8.1");
            expect(modal?.textContent).toContain('2026-07-11');
            expect(modal?.textContent).toContain('Reader scrollbars');
            expect(modal?.querySelector<HTMLImageElement>('.info-media__image')).toBeNull();
            expect(Array.from(modal?.querySelectorAll<HTMLButtonElement>('.mock-modal__button') ?? []).map((button) => button.textContent)).toEqual(['OK']);

            const okButton = modal?.querySelector<HTMLButtonElement>('.mock-modal__button');
            okButton?.click();
            await Promise.resolve();

            expect(bookmarksClient.ackChangelogNotice).toHaveBeenCalledWith('4.8.1');
        } finally {
            panel.hide();
        }
    });

    it('does not show the shared changelog notice in reader when no pending version exists', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                profile: 'conversation-reader',
            });
            await Promise.resolve();

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            expect(shadow.querySelector('.mock-modal')).toBeNull();
            expect(bookmarksClient.ackChangelogNotice).not.toHaveBeenCalled();
        } finally {
            panel.hide();
        }
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

    it('injects self-contained KaTeX styles when Reader content contains formulas', async () => {
        const panel = new ReaderPanel();

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'Inline $x+y$ math.' }], 0, 'light');
            await Promise.resolve();
            await Promise.resolve();

            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const markdownRoot = shadow.querySelector<HTMLElement>('.reader-markdown');
            const katexLink = shadow.querySelector<HTMLLinkElement>('link[data-aimd-style-link="aimd-reader-panel-katex"]');
            const katexEmbeddedStyle = shadow.querySelector<HTMLStyleElement>('style[data-aimd-style-link="aimd-reader-panel-katex-embedded"]');
            const katexFontFaceStyle = document.querySelector<HTMLStyleElement>('style[data-aimd-style-link="aimd-reader-katex-font-faces"]');

            expect(markdownRoot?.querySelector('.katex')).toBeTruthy();
            expect(katexLink?.rel).toBe('stylesheet');
            expect(getKatexCssWithRuntimeFontUrls).toHaveBeenCalledWith(expect.stringContaining('katex'));
            expect(getKatexRuntimeFontFaceCss).toHaveBeenCalledTimes(1);
            expect(katexEmbeddedStyle?.textContent).toContain('.katex{font-family:KaTeX_Main}');
            expect(katexFontFaceStyle?.textContent).toContain('@font-face{font-family:KaTeX_Main');
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

    it('opens Reader settings from the header and applies font-size changes live', async () => {
        const panel = new ReaderPanel();
        const onChange = vi.fn(async () => undefined);
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            detachedNoticeConfirmed: true,
        });
        panel.setReaderSettingsController({ onChange });

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const shell = shadow.querySelector<HTMLElement>('.panel-window--reader')!;

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-settings"]')!.click();
            const settingsPanel = shadow.querySelector<HTMLElement>('.panel-window--reader-settings')!;
            expect(settingsPanel).toBeTruthy();
            expect(settingsPanel.querySelector('.reader-settings-popover__footer-hint')).toBeNull();

            settingsPanel.querySelector<HTMLButtonElement>('[data-action="reader-settings-font-increase"]')!.click();
            await Promise.resolve();

            expect(onChange).toHaveBeenCalledWith({ bodyFontSizePx: 17 });
            expect(shell.getAttribute('style')).toContain('--aimd-reader-markdown-body-size: 17px');

            const contentWidth = settingsPanel.querySelector<HTMLInputElement>('[data-role="reader-settings-content-width"]')!;
            expect(contentWidth.type).toBe('range');
            expect(contentWidth.min).toBe('480');
            expect(contentWidth.max).toBe('1600');
            expect(contentWidth.step).toBe('20');
            expect(contentWidth.value).toBe('1000');

            contentWidth.value = '1531';
            contentWidth.dispatchEvent(new Event('change', { bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();

            expect(onChange).toHaveBeenCalledWith({ contentMaxWidthPx: 1540 });
            expect(settingsPanel.querySelector<HTMLElement>('[data-role="reader-settings-content-width-value"]')?.textContent).toBe('1540px');

            settingsPanel.querySelector<HTMLButtonElement>('[data-action="reader-settings-detached-notice-reset"]')!.click();
            await Promise.resolve();

            expect(onChange).toHaveBeenCalledWith({ detachedNoticeConfirmed: false });
        } finally {
            panel.hide();
        }
    });

    it('keeps Reader settings rows content-sized when opened from the header', async () => {
        const panel = new ReaderPanel();
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            detachedNoticeConfirmed: true,
        });

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-settings"]')!.click();
            const settingsPanel = shadow.querySelector<HTMLElement>('.panel-window--reader-settings')!;
            const styleText = Array.from(shadow.querySelectorAll('style')).map((node) => node.textContent ?? '').join('\n');

            expect(settingsPanel).toBeTruthy();
            expect(styleText).toContain('.dialog-body--reader-settings {');
            expect(styleText).toContain('grid-auto-rows: max-content;');
            expect(styleText).toContain('align-content: start;');
        } finally {
            panel.hide();
        }
    });

    it('routes Reader settings Prompt management through the shared manager only', async () => {
        const panel = new ReaderPanel();
        const onOpenManager = vi.fn(async () => undefined);
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            detachedNoticeConfirmed: true,
        });
        panel.setPromptManagerController({ onOpenManager });

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-settings"]')!.click();
            const settingsPanel = shadow.querySelector<HTMLElement>('.panel-window--reader-settings')!;
            const promptButton = settingsPanel.querySelector<HTMLButtonElement>('[data-action="reader-settings-prompt-manager"]')!;
            promptButton.click();
            await Promise.resolve();

            expect(onOpenManager).toHaveBeenCalledWith(promptButton);
            expect(shadow.querySelector('.reader-prompt-settings')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('loads current shared prompts when opening the Reader annotation copy picker', async () => {
        clearReaderCommentScope('reader-panel-comments-v1');
        saveReaderComment('reader-panel-comments-v1', {
            id: 'comment-1',
            itemId: 'a',
            quoteText: 'alpha',
            sourceMarkdown: '`alpha()`',
            comment: 'Tighten wording.',
            selectors: {
                textQuote: { exact: 'alpha', prefix: '', suffix: '' },
                textPosition: { start: 0, end: 5 },
                domRange: null,
                atomicRefs: [],
            },
            createdAt: 1,
            updatedAt: 1,
        });
        const panel = new ReaderPanel();
        const listReaderPrompts = vi.fn(async () => [
            { id: 'fresh', title: 'Fresh Shared Prompt', content: 'Use the current shared prompt with a long body that should stay out of the picker row.' },
        ]);
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            commentExport: {
                ...DEFAULT_SETTINGS.reader.commentExport,
                prompts: [{ id: 'legacy', title: 'Legacy Snapshot', content: 'Do not use this snapshot.' }],
            },
        });
        panel.setPromptManagerController({
            onOpenManager: vi.fn(async () => undefined),
            listReaderPrompts,
        });

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'alpha' }], 0, 'light');
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-copy-comments"]')!.click();
            await Promise.resolve();
            await Promise.resolve();

            expect(listReaderPrompts).toHaveBeenCalledTimes(1);
            const promptItem = shadow.querySelector<HTMLButtonElement>('.comment-prompt-picker__item[data-prompt-id="fresh"]')!;
            expect(promptItem.querySelector('.comment-prompt-picker__item-title')?.textContent).toBe('Fresh Shared Prompt');
            const preview = promptItem.querySelector<HTMLElement>('.comment-prompt-picker__item-content')!;
            expect(preview.textContent).toBe('Use the current shared prompt with a long body that should stay out of the picker row.');
            expect(preview.textContent).not.toContain('\n');
            expect(shadow.querySelector('.comment-prompt-picker__item[data-prompt-id="legacy"]')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('does not open the retired Reader-only Prompt editor when no shared manager is available', async () => {
        const panel = new ReaderPanel();
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            detachedNoticeConfirmed: true,
        });

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            shadow.querySelector<HTMLButtonElement>('[data-action="reader-settings"]')!.click();
            const settingsPanel = shadow.querySelector<HTMLElement>('.panel-window--reader-settings')!;
            settingsPanel.querySelector<HTMLButtonElement>('[data-action="reader-settings-prompt-manager"]')!.click();
            await Promise.resolve();

            expect(shadow.querySelector('.reader-prompt-settings')).toBeNull();
        } finally {
            panel.hide();
        }
    });

    it('uses a custom close handler when the detached Reader owns the surface', async () => {
        const panel = new ReaderPanel();
        const onRequestClose = vi.fn(async () => undefined);

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light', {
                onRequestClose,
            });
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;

            shadow.querySelector<HTMLButtonElement>('[data-action="close-panel"]')!.click();
            await Promise.resolve();

            expect(onRequestClose).toHaveBeenCalledTimes(1);
            expect(document.querySelector('#aimd-reader-panel-host')).toBeTruthy();
        } finally {
            panel.hide();
        }
    });

    it('opens in panel mode and persists center-symmetric resize as viewport ratios', async () => {
        const panel = new ReaderPanel();
        const onChange = vi.fn(async () => undefined);
        panel.setReaderSettings({
            ...DEFAULT_SETTINGS.reader,
            defaultOpenMode: 'panel',
            panelSizeRatio: { widthRatio: 0.6, heightRatio: 0.7 },
        });
        panel.setReaderSettingsController({ onChange });

        try {
            await panel.show([{ id: 'a', userPrompt: 'Prompt', content: 'md1' }], 0, 'light');
            const host = document.querySelector('#aimd-reader-panel-host') as HTMLElement;
            const shadow = host.shadowRoot as ShadowRoot;
            const shell = shadow.querySelector<HTMLElement>('.panel-window--reader')!;
            expect(shell.dataset.fullscreen).toBe('0');

            shell.getBoundingClientRect = () => ({
                x: 0,
                y: 0,
                left: 0,
                top: 0,
                right: 600,
                bottom: 500,
                width: 600,
                height: 500,
                toJSON: () => ({}),
            } as DOMRect);

            shadow.querySelector<HTMLElement>('[data-action="reader-panel-resize"]')!
                .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 500 }));
            document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 650, clientY: 540 }));
            document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 650, clientY: 540 }));

            expect(onChange).toHaveBeenCalledWith({
                panelSizeRatio: expect.objectContaining({
                    widthRatio: expect.any(Number),
                    heightRatio: expect.any(Number),
                }),
            });
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
        expect(source).toContain('font-size: var(--aimd-reader-markdown-body-size, var(--aimd-text-base));');
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

    it('keeps the sticky workspace scoped, token-driven, and drawer-only on narrow screens', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');
        const stickyStart = source.indexOf('.reader-sticky-panel {');
        const stickyEnd = source.indexOf('.reader-body {', stickyStart);
        const stickyCss = source.slice(stickyStart, stickyEnd);
        const narrowStart = source.indexOf('@media (max-width: 900px)');
        const narrowEnd = source.indexOf('@media (prefers-reduced-motion: reduce)', narrowStart);
        const narrowCss = source.slice(narrowStart, narrowEnd);

        expect(stickyCss).toContain('.reader-sticky-panel {');
        expect(stickyCss).toContain('max-width: 66.6667%;');
        expect(stickyCss).toContain('.reader-sticky-shell {');
        expect(stickyCss).toContain('.reader-sticky-block {');
        expect(stickyCss).toContain('grid-template-columns: var(--aimd-size-control-icon-panel) minmax(0, 1fr);');
        expect(stickyCss).toContain('justify-self: center;');
        expect(stickyCss).toContain('max-height: none;');
        expect(stickyCss).toContain('.reader-sticky-resize {');
        expect(stickyCss).toContain('var(--aimd-');
        expect(stickyCss).not.toContain('!important');
        expect(stickyCss).not.toContain('border: 1px solid var(--aimd-border-subtle);');
        expect(narrowCss).toContain('.reader-sticky-panel {');
        expect(narrowCss).toContain('position: absolute;');
        expect(narrowCss).toContain('box-shadow: var(--aimd-shadow-panel);');
        expect(narrowCss).not.toContain('grid-template-columns');
    });

    it('themes Reader scrollbars from shared light and dark tokens', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');

        expect(source).toContain('.reader-body,\n.reader-sticky-list,\n.reader-outline-rail__list {');
        expect(source).toContain('scrollbar-color: var(--aimd-scrollbar-thumb) transparent;');
        expect(source).toContain('.reader-body::-webkit-scrollbar-track,');
        expect(source).toContain('background: transparent;');
        expect(source).toContain('.reader-body::-webkit-scrollbar-thumb,');
        expect(source).toContain('background: var(--aimd-scrollbar-thumb);');
        expect(source).toContain('background: var(--aimd-scrollbar-thumb-hover);');
    });

    it('keeps the reader outline rail scoped, token-driven, and responsive', () => {
        const source = fs.readFileSync(path.join(process.cwd(), 'src/ui/content/reader/readerPanelTemplate.ts'), 'utf8');
        const outlineStart = source.indexOf('.reader-outline-rail {');
        const outlineEnd = source.indexOf('@supports not', outlineStart);
        const outlineCss = source.slice(outlineStart, outlineEnd);

        expect(outlineCss).toContain('.reader-outline-rail {');
        expect(outlineCss).toContain('.reader-outline-rail:hover,');
        expect(outlineCss).toContain('.reader-outline-rail:focus-within');
        expect(outlineCss).toContain('.reader-outline-rail__item:focus-visible');
        expect(outlineCss).toContain('align-items: stretch;');
        expect(outlineCss).toContain('justify-content: flex-start;');
        expect(outlineCss).toContain('grid-template-columns: 2.75em minmax(0, 1fr);');
        expect(outlineCss).toContain('grid-auto-flow: column;');
        expect(outlineCss).toContain('grid-row: 1;');
        expect(outlineCss).toContain('white-space: nowrap;');
        expect(outlineCss).toContain('text-overflow: ellipsis;');
        expect(outlineCss).toContain('--_reader-outline-indent: 0px;');
        expect(outlineCss).toContain('padding-left: var(--_reader-outline-indent);');
        expect(outlineCss).toContain('@media (max-width: 900px)');
        expect(outlineCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(outlineCss).toContain('var(--aimd-');
        expect(outlineCss).not.toContain('!important');
        expect(outlineCss).not.toContain('#2563eb');
        expect(source).toContain('.panel-window--reader {');
    });
});
