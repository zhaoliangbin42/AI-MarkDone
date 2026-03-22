import { describe, expect, it } from 'vitest';
import { ChatGPTFoldBar } from '@/ui/content/chatgptFolding/ChatGPTFoldBar';
import { ChatGPTFoldDock } from '@/ui/content/chatgptFolding/ChatGPTFoldDock';

describe('ChatGPTFoldBar', () => {
    it('uses a flat single-line summary row with theme-aware surface, border, and hover feedback', () => {
        const bar = new ChatGPTFoldBar('light', { onToggle() {} });
        const style = bar.getElement().shadowRoot?.querySelector('style')?.textContent ?? '';

        expect(style).toContain('.bar {');
        expect(style).toContain('--_foldbar-min-height: calc(var(--aimd-size-control-icon-toolbar) + var(--aimd-space-2));');
        expect(style).toContain('white-space: nowrap;');
        expect(style).not.toContain('-webkit-line-clamp: 2;');
        expect(style).toContain('--_foldbar-surface: color-mix(in srgb, var(--aimd-bg-surface) 95%, var(--aimd-bg-primary));');
        expect(style).toContain('border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, var(--aimd-interactive-primary));');
        expect(style).toContain('.bar:hover {');
        expect(style).toContain('background: color-mix(in srgb, var(--_foldbar-surface) 84%, var(--aimd-interactive-hover));');
        expect(style).toContain('border-color: color-mix(in srgb, var(--aimd-border-strong) 70%, var(--aimd-interactive-primary));');
        expect(style).toContain('.bar:active {');
        expect(style).toContain('background: color-mix(in srgb, var(--_foldbar-surface) 80%, var(--aimd-interactive-active));');
        expect(style).toContain('width: var(--aimd-size-control-icon-toolbar);');
        expect(style).toContain('height: var(--aimd-size-control-icon-toolbar);');
        expect(style).toContain('width: var(--aimd-size-control-glyph-panel);');
        expect(style).toContain('height: var(--aimd-size-control-glyph-panel);');
        expect(style).toContain('font-size: var(--aimd-text-xs);');
        expect(style).not.toContain('box-shadow: var(--aimd-shadow-xs);');
        expect(style).not.toContain('box-shadow: var(--aimd-shadow-sm);');
        expect(style).not.toContain('--_foldbar-toggle-surface');
        expect(style).toContain('background: transparent;');
    });

    it('uses a theme-aware compact dock surface with shorter buttons', () => {
        const dock = new ChatGPTFoldDock('light', { onCollapseAll() {}, onExpandAll() {} });
        const style = dock.getElement().shadowRoot?.querySelector('style')?.textContent ?? '';

        expect(style).toContain('.dock {');
        expect(style).toContain('min-height: calc(var(--aimd-space-3) * 6);');
        expect(style).toContain('background: color-mix(in srgb, var(--aimd-bg-surface) 96%, var(--aimd-bg-primary));');
        expect(style).toContain('.btn {');
        expect(style).toContain('min-height: calc(var(--aimd-space-3) * 3);');
        expect(style).toContain('font-size: var(--aimd-text-sm);');
        expect(style).toContain('.btn:hover { background: color-mix(in srgb, var(--aimd-interactive-hover) 90%, var(--aimd-sys-color-surface-hover)); }');
    });

    it('does not pin fold bar or dock to white surfaces in dark mode', () => {
        const barStyle = new ChatGPTFoldBar('dark', { onToggle() {} }).getElement().shadowRoot?.querySelector('style')?.textContent ?? '';
        const dockStyle = new ChatGPTFoldDock('dark', { onCollapseAll() {}, onExpandAll() {} }).getElement().shadowRoot?.querySelector('style')?.textContent ?? '';

        expect(barStyle).not.toContain('--_foldbar-surface: var(--aimd-color-white);');
        expect(barStyle).not.toContain('background: var(--aimd-color-white);');
        expect(dockStyle).not.toContain('background: var(--aimd-color-white);');
    });
});
