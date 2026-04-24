import { describe, expect, it } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';
import { vi } from 'vitest';

describe('MessageToolbar', () => {
    it('uses 30px icon buttons in both content and actionbar placements', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: false });
        const shadow = toolbar.getElement().shadowRoot;
        const style = shadow?.querySelector<HTMLStyleElement>('style[data-aimd-style-id="aimd-toolbar-base"]');

        expect(style?.textContent).toContain('.icon-btn {');
        expect(style?.textContent).toContain('width: var(--aimd-size-control-icon-toolbar);');
        expect(style?.textContent).toContain('height: var(--aimd-size-control-icon-toolbar);');
        expect(style?.textContent).toContain(':host([data-aimd-placement="actionbar"]) .icon-btn { width: var(--aimd-size-control-icon-toolbar); height: var(--aimd-size-control-icon-toolbar);');
    });

    it('collapses the stats slot while pending so streaming toolbars stay compact', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: true });
        toolbar.setPlacement('content');
        toolbar.setPending(true);
        toolbar.setStats([]);

        const host = toolbar.getElement();
        const shadow = host.shadowRoot;
        const stats = shadow?.querySelector<HTMLElement>('[data-role="stats"]') ?? null;
        const statsSeparator = shadow?.querySelector<HTMLElement>('[data-role="stats-separator"]') ?? null;

        expect(host.getAttribute('data-aimd-pending')).toBe('1');
        expect(stats?.dataset.empty).toBe('1');
        expect(statsSeparator?.hidden).toBe(true);
    });

    it('restores the stats slot after streaming completes', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: true });
        toolbar.setPlacement('content');
        toolbar.setPending(true);
        toolbar.setStats([]);
        toolbar.setPending(false);
        toolbar.setStats(['7 Words', '24 Chars']);

        const host = toolbar.getElement();
        const shadow = host.shadowRoot;
        const stats = shadow?.querySelector<HTMLElement>('[data-role="stats"]') ?? null;
        const statsSeparator = shadow?.querySelector<HTMLElement>('[data-role="stats-separator"]') ?? null;

        expect(host.getAttribute('data-aimd-pending')).toBe('0');
        expect(stats?.dataset.empty).toBe('0');
        expect(stats?.children).toHaveLength(2);
        expect(statsSeparator?.hidden).toBe(false);
    });

    it('uses canonical hover and menu surface tokens instead of hardcoded black and white mixes', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: false });
        const shadow = toolbar.getElement().shadowRoot;
        const style = shadow?.querySelector<HTMLStyleElement>('style[data-aimd-style-id="aimd-toolbar-base"]');
        const css = style?.textContent ?? '';

        expect(css).toContain('--aimd-button-icon-hover');
        expect(css).toContain('--aimd-button-icon-active');
        expect(css).toContain('--aimd-bg-surface');
        expect(css).not.toContain('#000');
        expect(css).not.toContain('#fff');
    });

    it('keeps stats text and glyph sizing on toolbar tokens instead of raw pixel values', () => {
        const toolbar = new MessageToolbar('light', [], { showStats: false });
        const shadow = toolbar.getElement().shadowRoot;
        const style = shadow?.querySelector<HTMLStyleElement>('style[data-aimd-style-id="aimd-toolbar-base"]');
        const css = style?.textContent ?? '';

        expect(css).toContain('.stats {');
        expect(css).toContain('font-size: var(--aimd-text-xs);');
        expect(css).toContain('.icon-btn svg { width: var(--aimd-size-control-glyph-panel); height: var(--aimd-size-control-glyph-panel); display: block; }');
        expect(css).not.toContain('font-size: 11px;');
        expect(css).not.toContain('.icon-btn svg { width: 16px; height: 16px; display: block; }');
    });

    it('keeps Copy primary click behavior while exposing a hover-triggered PNG secondary action', async () => {
        vi.useFakeTimers();
        const onCopyMarkdown = vi.fn(async () => ({ ok: true as const, message: 'Copied!' }));
        const onCopyPng = vi.fn(async () => ({ ok: true as const, message: 'PNG copied!' }));

        const toolbar = new MessageToolbar('light', [
            {
                id: 'copy_markdown',
                label: 'Copy Markdown',
                tooltip: 'Copy Markdown',
                icon: '<svg viewBox="0 0 16 16"></svg>',
                onClick: onCopyMarkdown,
                hoverAction: {
                    id: 'copy_png',
                    label: 'Copy as PNG',
                    icon: '<svg viewBox="0 0 16 16"></svg>',
                    onClick: onCopyPng,
                },
            },
        ], { showStats: false });

        document.body.appendChild(toolbar.getElement());
        const shadow = toolbar.getElement().shadowRoot!;
        const button = shadow.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!;

        button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.runAllTimers();

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host');
        const portalShadow = portalHost?.shadowRoot;
        const secondaryButton = portalShadow?.querySelector<HTMLButtonElement>('[data-role="toolbar-hover-action"]');
        expect(secondaryButton?.textContent).toContain('Copy as PNG');

        button.click();
        await Promise.resolve();
        expect(onCopyMarkdown).toHaveBeenCalledTimes(1);

        secondaryButton?.click();
        await Promise.resolve();
        expect(onCopyPng).toHaveBeenCalledTimes(1);

        toolbar.dispose();
        toolbar.getElement().remove();
        vi.useRealTimers();
    });

    it('removes the body-level hover action portal after the trigger leaves', () => {
        vi.useFakeTimers();
        const toolbar = new MessageToolbar('light', [
            {
                id: 'copy_markdown',
                label: 'Copy Markdown',
                tooltip: 'Copy Markdown',
                icon: '<svg viewBox="0 0 16 16"></svg>',
                onClick: vi.fn(async () => ({ ok: true as const, message: 'Copied!' })),
                hoverAction: {
                    id: 'copy_png',
                    label: 'Copy as PNG',
                    icon: '<svg viewBox="0 0 16 16"></svg>',
                    onClick: vi.fn(async () => ({ ok: true as const, message: 'PNG copied!' })),
                },
            },
        ], { showStats: false });

        document.body.appendChild(toolbar.getElement());
        const button = toolbar.getElement().shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!;

        button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(100);
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).not.toBeNull();

        button.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        vi.advanceTimersByTime(120);
        expect(document.querySelector('.aimd-toolbar-hover-action-host')).toBeNull();

        toolbar.dispose();
        toolbar.getElement().remove();
        vi.useRealTimers();
    });

    it('keeps the hover action clickable when pointerdown originates inside its shadow button', async () => {
        vi.useFakeTimers();
        const onCopyPng = vi.fn(async () => ({ ok: true as const, message: 'PNG copied!' }));
        const toolbar = new MessageToolbar('light', [
            {
                id: 'copy_markdown',
                label: 'Copy Markdown',
                tooltip: 'Copy Markdown',
                icon: '<svg viewBox="0 0 16 16"></svg>',
                onClick: vi.fn(async () => ({ ok: true as const, message: 'Copied!' })),
                hoverAction: {
                    id: 'copy_png',
                    label: 'Copy as PNG',
                    icon: '<svg viewBox="0 0 16 16"></svg>',
                    onClick: onCopyPng,
                },
            },
        ], { showStats: false });

        document.body.appendChild(toolbar.getElement());
        const trigger = toolbar.getElement().shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!;

        trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        vi.advanceTimersByTime(100);

        const portalHost = document.querySelector<HTMLElement>('.aimd-toolbar-hover-action-host')!;
        const secondaryButton = portalHost.shadowRoot!.querySelector<HTMLButtonElement>('[data-role="toolbar-hover-action"]')!;
        secondaryButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        secondaryButton.click();
        await Promise.resolve();

        expect(onCopyPng).toHaveBeenCalledTimes(1);

        toolbar.dispose();
        toolbar.getElement().remove();
        vi.useRealTimers();
    });
});
