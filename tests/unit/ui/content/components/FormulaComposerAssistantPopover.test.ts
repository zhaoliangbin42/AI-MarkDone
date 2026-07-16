import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulaComposerAssistantPopover } from '@/ui/content/components/FormulaComposerAssistantPopover';

const suggestion = {
    id: 'frac',
    label: '\\frac',
    insertText: '\\frac{$1}{$2}',
    detail: 'fraction',
    category: 'structure',
    priority: 100,
};

describe('FormulaComposerAssistantPopover', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.dataset.aimdTheme = 'light';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete document.documentElement.dataset.aimdTheme;
    });

    it('renders a theme-aware formula preview and reuses the composer suggestion row primitive', () => {
        const onSelect = vi.fn();
        const popover = new FormulaComposerAssistantPopover({ onSelect });
        popover.show({
            anchorRect: new DOMRect(100, 100, 0, 20),
            mathKind: 'inline',
            preview: {
                status: 'ready',
                asset: {
                    source: '\\frac{a}{b}',
                    displayMode: false,
                    fontSizePx: 36,
                    width: 72,
                    height: 36,
                    viewBox: '0 0 72 36',
                    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36"><path fill="#000000" d="M0 0h1v1z"/></svg>',
                },
            },
            suggestions: [suggestion],
            selectedIndex: 0,
        });

        const shadow = popover.host.shadowRoot!;
        expect(popover.host.dataset.aimdRole).toBe('formula-composer-assistant');
        expect(shadow.querySelector('[data-role="formula-preview"] svg')).not.toBeNull();
        expect(shadow.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
        expect(shadow.querySelector('[data-role="formula-suggestion"]')?.classList.contains('composer-suggestion-row')).toBe(true);

        shadow.querySelector<HTMLButtonElement>('[data-role="formula-suggestion"]')?.click();
        expect(onSelect).toHaveBeenCalledWith(0);
        popover.dispose();
    });

    it('shows loading and error states without stealing focus', () => {
        const input = document.createElement('textarea');
        document.body.appendChild(input);
        input.focus();
        const popover = new FormulaComposerAssistantPopover({ onSelect: vi.fn() });

        popover.show({
            anchorRect: new DOMRect(0, 0, 0, 0),
            mathKind: 'display',
            preview: { status: 'loading' },
            suggestions: [],
            selectedIndex: 0,
        });
        expect(popover.host.shadowRoot?.querySelector('[data-role="formula-preview-status"]')).not.toBeNull();
        expect(document.activeElement).toBe(input);

        popover.show({
            anchorRect: new DOMRect(0, 0, 0, 0),
            mathKind: 'display',
            preview: { status: 'error' },
            suggestions: [],
            selectedIndex: 0,
        });
        expect(popover.host.shadowRoot?.querySelector('[data-state="error"]')).not.toBeNull();
        popover.dispose();
    });

    it('supports two isolated instances for mock and collision testing', () => {
        const first = new FormulaComposerAssistantPopover({ onSelect: vi.fn() });
        const second = new FormulaComposerAssistantPopover({ onSelect: vi.fn() });
        expect(first.host).not.toBe(second.host);
        expect(document.querySelectorAll('[data-aimd-role="formula-composer-assistant"]')).toHaveLength(2);
        first.dispose();
        second.dispose();
    });

    it('renders suggestions without reserving a formula preview region', () => {
        const popover = new FormulaComposerAssistantPopover({ onSelect: vi.fn() });
        popover.show({
            anchorRect: new DOMRect(100, 100, 0, 20),
            mathKind: 'inline',
            preview: null,
            suggestions: [suggestion],
            selectedIndex: 0,
        });

        const shadow = popover.host.shadowRoot!;
        expect(shadow.querySelector('[data-role="formula-preview"]')).toBeNull();
        expect(shadow.querySelector('[data-role="formula-suggestion"]')).not.toBeNull();
        popover.dispose();
    });

    it('uses an anchored Surface session without stealing composer focus and dismisses on an outside click', async () => {
        const composer = document.createElement('textarea');
        const outside = document.createElement('button');
        document.body.append(composer, outside);
        composer.focus();
        const onDismiss = vi.fn();
        const popover = new FormulaComposerAssistantPopover({
            onSelect: vi.fn(),
            onDismiss,
            getDismissRoots: () => [composer],
        });
        popover.show({
            anchorRect: new DOMRect(100, 100, 0, 20),
            mathKind: 'inline',
            preview: null,
            suggestions: [suggestion],
            selectedIndex: 0,
        });
        await Promise.resolve();

        const root = popover.host.shadowRoot!.querySelector<HTMLElement>('.formula-assistant')!;
        expect(document.activeElement).toBe(composer);
        expect(root.dataset.motionState).toBe('opening');
        expect(root.style.getPropertyValue('--_surface-motion-open-duration')).toBe('180ms');

        outside.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        outside.dispatchEvent(new Event('click', { bubbles: true, composed: true }));

        expect(popover.isOpen()).toBe(false);
        expect(onDismiss).toHaveBeenCalledWith('outside');
        popover.dispose();
    });

    it('handles Escape from the composer while the anchored preview keeps composer focus', () => {
        const composer = document.createElement('textarea');
        document.body.appendChild(composer);
        composer.focus();
        const onDismiss = vi.fn();
        const popover = new FormulaComposerAssistantPopover({
            onSelect: vi.fn(),
            onDismiss,
            getDismissRoots: () => [composer],
        });
        popover.show({
            anchorRect: new DOMRect(100, 100, 0, 20),
            mathKind: 'inline',
            preview: { status: 'loading' },
            suggestions: [],
            selectedIndex: 0,
        });

        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        composer.dispatchEvent(escape);

        expect(escape.defaultPrevented).toBe(true);
        expect(popover.isOpen()).toBe(false);
        expect(onDismiss).toHaveBeenCalledWith('escape');
        expect(document.activeElement).toBe(composer);
        popover.dispose();
    });

    it('updates an open preview without restarting the anchored enter motion', () => {
        const popover = new FormulaComposerAssistantPopover({ onSelect: vi.fn() });
        const view = {
            anchorRect: new DOMRect(100, 100, 0, 20),
            mathKind: 'inline' as const,
            preview: null,
            suggestions: [suggestion],
            selectedIndex: 0,
        };
        popover.show(view);
        const root = popover.host.shadowRoot!.querySelector<HTMLElement>('.formula-assistant')!;
        root.dataset.motionState = 'open';

        popover.show({ ...view, selectedIndex: 0 });

        expect(root.dataset.motionState).toBe('open');
        popover.dispose();
    });
});
