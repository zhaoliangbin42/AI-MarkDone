import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SendPopover } from '@/ui/content/sending/SendPopover';
import { setLocale } from '@/ui/content/components/i18n';

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('SendPopover', () => {
    beforeEach(() => {
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

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('opens with the mock send-popover structure and closes on outside click / ESC', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const anchor = document.createElement('div');
        footerLeft.appendChild(anchor);

        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });
        const opened = footerLeft.querySelector<HTMLElement>('.send-popover');
        const styleNode = shadow.querySelector('style[data-aimd-send-popover-style]');
        expect(opened).toBeTruthy();
        expect(styleNode).toBeTruthy();
        expect(opened?.querySelector('.send-popover__head')).toBeTruthy();
        expect(opened?.querySelector('.send-popover__head-actions')).toBeTruthy();
        expect(opened?.querySelector('.send-popover__resize-handle')).toBeTruthy();
        expect(opened?.querySelector('.send-popover__resize-grip')).toBeTruthy();
        expect(opened?.querySelector<HTMLTextAreaElement>('.send-popover__input')?.value).toBe('hi');
        expect(opened?.querySelector<HTMLTextAreaElement>('.send-popover__input')?.classList.contains('aimd-field-control')).toBe(true);
        expect(opened?.querySelector('.send-popover__foot .status-line')).toBeTruthy();
        expect(opened?.querySelector('.send-popover__foot .button-row')).toBeTruthy();
        expect(opened?.querySelector('[data-tooltip]')).toBeNull();
        expect(opened?.querySelector('.send-popover__resize-handle')?.getAttribute('title')).toBeNull();
        expect(styleNode?.textContent).toContain('top: 6px;');
        expect(styleNode?.textContent).toContain('right: 6px;');
        expect(styleNode?.textContent).toContain('padding-right: 14px;');
        expect(styleNode?.textContent).toContain('linear-gradient(135deg, transparent 0 40%, currentColor 40% 48%');
        expect(styleNode?.textContent).toContain('.send-popover__resize-handle,');
        expect(styleNode?.textContent).toContain('.send-popover__resize-handle:hover,');
        expect(styleNode?.textContent).toContain('border-color: transparent;');
        expect(styleNode?.textContent).toContain('transition: none;');
        expect(styleNode?.textContent).not.toContain('rgba(255,255,255,0.72)');
        expect(styleNode?.textContent).not.toContain('#0f172a');
        expect(styleNode?.textContent).toContain('z-index: var(--aimd-z-tooltip);');
        expect(styleNode?.textContent).toContain('background: var(--aimd-button-icon-hover);');
        expect(styleNode?.textContent).toContain('background: var(--aimd-button-secondary-hover);');
        expect(styleNode?.textContent).toContain('background: var(--aimd-interactive-primary-hover);');

        // ESC closes (bubble is mounted as child of footerLeft)
        const el = footerLeft.querySelector('.send-popover') as HTMLElement;
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(footerLeft.querySelector('.send-popover')).toBeNull();

        // Reopen and close via outside click.
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });
        expect(footerLeft.querySelector('.send-popover')).toBeTruthy();
        const outside = document.createElement('div');
        shadow.appendChild(outside);
        outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        expect(footerLeft.querySelector('.send-popover')).toBeNull();
    });

    it('closes when clicking outside the shadow surface on the page document', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });
        expect(footerLeft.querySelector('.send-popover')).toBeTruthy();

        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

        expect(footerLeft.querySelector('.send-popover')).toBeNull();
        host.remove();
    });

    it('resizes upward and to the right from the top-right handle while clamping to the panel bounds', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        panel.style.width = '760px';
        panel.style.height = '520px';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const anchor = document.createElement('div');
        footerLeft.appendChild(anchor);

        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });

        const popover = footerLeft.querySelector<HTMLElement>('.send-popover')!;
        const handle = footerLeft.querySelector<HTMLElement>('.send-popover__resize-handle')!;
        const startWidth = Number.parseFloat(popover.style.width);
        const startHeight = Number.parseFloat(popover.style.height);

        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 300, clientY: 240 }));
        window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 360, clientY: 180 }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 360, clientY: 180 }));

        expect(Number.parseFloat(popover.style.width)).toBeGreaterThan(startWidth);
        expect(Number.parseFloat(popover.style.height)).toBeGreaterThan(startHeight);
        expect(Number.parseFloat(popover.style.width)).toBeLessThanOrEqual(680);
        expect(Number.parseFloat(popover.style.height)).toBeLessThanOrEqual(400);

        pop.close(shadow, { syncBack: false });
    });

    it('syncs the draft into the official composer infrastructure while typing', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const anchor = document.createElement('div');
        footerLeft.appendChild(anchor);

        const composer = document.createElement('textarea');
        composer.value = 'seed';
        document.body.appendChild(composer);

        const adapter = {
            getComposerInputElement: () => composer,
            getComposerSendButtonElement: () => null,
            getComposerKind: () => 'textarea',
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light' });

        const textarea = footerLeft.querySelector<HTMLTextAreaElement>('.send-popover__input')!;
        textarea.value = 'hello world';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await Promise.resolve();

        expect(composer.value).toBe('seed');

        pop.close(shadow, { syncBack: true });
        await Promise.resolve();

        expect(composer.value).toBe('hello world');

        composer.remove();
    });

    it('does not rewrite the official composer during open when reading an initial draft', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const composer = document.createElement('textarea');
        composer.value = 'seed';
        document.body.appendChild(composer);

        const adapter = {
            getComposerInputElement: () => composer,
            getComposerSendButtonElement: () => null,
            getComposerKind: () => 'textarea',
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light' });
        await Promise.resolve();

        expect(composer.value).toBe('seed');

        pop.close(shadow, { syncBack: false });
        composer.remove();
    });

    it('keeps typing events inside the popover so host listeners cannot steal focus from the draft textarea', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const composer = document.createElement('textarea');
        composer.value = 'seed';
        document.body.appendChild(composer);

        const adapter = {
            getComposerInputElement: () => composer,
            getComposerSendButtonElement: () => null,
            getComposerKind: () => 'textarea',
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light' });
        await Promise.resolve();

        const textarea = footerLeft.querySelector<HTMLTextAreaElement>('.send-popover__input')!;
        const hostInputSpy = vi.fn(() => composer.focus());
        document.addEventListener('input', hostInputSpy);

        textarea.focus();
        textarea.value = 'hello';
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: 'o', inputType: 'insertText' }));
        await Promise.resolve();

        expect(hostInputSpy).toHaveBeenCalledTimes(0);
        expect(shadow.activeElement).toBe(textarea);

        document.removeEventListener('input', hostInputSpy);
        pop.close(shadow, { syncBack: false });
        composer.remove();
        host.remove();
    });

    it('keeps pointer and focus events inside the popover draft textarea so host listeners cannot hijack focus on click', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const composer = document.createElement('textarea');
        composer.value = 'seed';
        document.body.appendChild(composer);

        const adapter = {
            getComposerInputElement: () => composer,
            getComposerSendButtonElement: () => null,
            getComposerKind: () => 'textarea',
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light' });
        await Promise.resolve();

        const textarea = footerLeft.querySelector<HTMLTextAreaElement>('.send-popover__input')!;
        const hostMouseDownSpy = vi.fn(() => composer.focus());
        const hostFocusSpy = vi.fn(() => composer.focus());
        document.addEventListener('mousedown', hostMouseDownSpy);
        document.addEventListener('focusin', hostFocusSpy);

        textarea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
        textarea.focus();
        await Promise.resolve();

        expect(hostMouseDownSpy).toHaveBeenCalledTimes(0);
        expect(hostFocusSpy).toHaveBeenCalledTimes(0);
        expect(shadow.activeElement).toBe(textarea);

        document.removeEventListener('mousedown', hostMouseDownSpy);
        document.removeEventListener('focusin', hostFocusSpy);
        pop.close(shadow, { syncBack: false });
        composer.remove();
        host.remove();
    });

    it('does not surface a composer-not-found error when opened without an available composer input', async () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });
        await Promise.resolve();

        const status = footerLeft.querySelector<HTMLElement>('.send-popover [data-role="status"]');
        expect(status?.textContent).toBe('');

        pop.close(shadow, { syncBack: false });
    });

    it('updates visible copy immediately when the locale changes', async () => {
        await setLocale('en');
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        const panel = document.createElement('div');
        panel.className = 'panel-window panel-window--reader';
        const footerLeft = document.createElement('div');
        footerLeft.className = 'reader-footer__left';
        footerLeft.setAttribute('data-role', 'footer-left-actions');
        panel.appendChild(footerLeft);
        shadow.appendChild(panel);

        const adapter = {
            getComposerInputElement: () => null,
            getComposerSendButtonElement: () => null,
        } as any;

        const pop = new SendPopover();
        pop.open({ shadow, anchor: footerLeft, adapter, theme: 'light', initialText: 'hi' });

        expect(footerLeft.querySelector('.send-popover__head strong')?.textContent).toBe('Send');
        expect(footerLeft.querySelector('.send-popover__resize-handle')?.getAttribute('aria-label')).toBe('Resize send popover');

        await setLocale('zh_CN');
        await Promise.resolve();

        expect(footerLeft.querySelector('.send-popover__head strong')?.textContent).toBe('发送');
        expect(footerLeft.querySelector('.send-popover__resize-handle')?.getAttribute('aria-label')).toBe('调整发送浮层大小');

        pop.close(shadow, { syncBack: false });
    });
});
