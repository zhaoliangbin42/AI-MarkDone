import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputEnhancementPopover } from '@/ui/content/components/InputEnhancementPopover';
import { DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS } from '@/core/settings/types';

describe('InputEnhancementPopover', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('presents the controls as a compact master, authoring group, and formula group', () => {
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const popover = new InputEnhancementPopover({
            onChange: vi.fn(),
            onClose: vi.fn(),
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });

        const shadow = popover.host.shadowRoot!;
        expect(shadow.querySelector('[data-role="input-enhancement-master"]')).not.toBeNull();
        expect(shadow.querySelector('[data-role="input-enhancement-authoring-section"]')).not.toBeNull();
        expect(shadow.querySelector('[data-role="input-enhancement-formula-section"]')).not.toBeNull();
        expect(shadow.querySelector('[data-role="input-enhancement-list-types"]')?.getAttribute('role')).toBe('group');
        expect(shadow.querySelectorAll('.input-enhancement-description')).toHaveLength(1);

        popover.dispose();
    });

    it('keeps detailed preferences visible and preserved when the runtime master is disabled', () => {
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const onChange = vi.fn();
        const popover = new InputEnhancementPopover({
            onChange,
            onClose: vi.fn(),
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });

        const shadow = popover.host.shadowRoot!;
        const master = shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-enabled"]')!;
        master.checked = false;
        master.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onChange).toHaveBeenCalledWith({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            enabled: false,
        });
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-enter-newline"]')?.disabled).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-list-ordered"]')?.checked).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-list-unordered"]')?.checked).toBe(true);
        popover.dispose();
    });

    it('disables only list type controls when the list master is off and preserves their values', () => {
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const onChange = vi.fn();
        const popover = new InputEnhancementPopover({
            onChange,
            onClose: vi.fn(),
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });

        const shadow = popover.host.shadowRoot!;
        const lists = shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-lists"]')!;
        lists.checked = false;
        lists.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onChange).toHaveBeenCalledWith({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            lists: { enabled: false, ordered: true, unordered: true },
        });
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-list-ordered"]')?.disabled).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-list-ordered"]')?.checked).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-list-unordered"]')?.disabled).toBe(true);
        expect(shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-bold"]')?.disabled).toBe(false);
        popover.dispose();
    });

    it('updates each compact list type choice independently', () => {
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const onChange = vi.fn();
        const popover = new InputEnhancementPopover({
            onChange,
            onClose: vi.fn(),
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });

        const unordered = popover.host.shadowRoot!
            .querySelector<HTMLInputElement>('[data-role="input-enhancement-list-unordered"]')!;
        unordered.checked = false;
        unordered.dispatchEvent(new Event('change', { bubbles: true }));

        expect(onChange).toHaveBeenCalledWith({
            ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
            lists: { enabled: true, ordered: true, unordered: false },
        });
        popover.dispose();
    });

    it('marks the surface busy and disables every setting while a save is pending', () => {
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        const popover = new InputEnhancementPopover({
            onChange: vi.fn(),
            onClose: vi.fn(),
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
            pending: true,
        });

        const shadow = popover.host.shadowRoot!;
        expect(shadow.querySelector('.input-enhancement-body')?.getAttribute('aria-busy')).toBe('true');
        expect([...shadow.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every((input) => input.disabled)).toBe(true);
        popover.dispose();
    });

    it('closes on Escape and outside pointer input while ignoring its anchor', () => {
        const anchor = document.createElement('button');
        const outside = document.createElement('button');
        document.body.append(anchor, outside);
        const onClose = vi.fn();
        const popover = new InputEnhancementPopover({
            onChange: vi.fn(),
            onClose,
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });

        anchor.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        anchor.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
        expect(popover.isOpen()).toBe(true);
        const escape = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            composed: true,
            cancelable: true,
        });
        popover.host.shadowRoot!
            .querySelector<HTMLInputElement>('[data-role="input-enhancement-enabled"]')!
            .dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(true);
        expect(onClose).toHaveBeenLastCalledWith('escape');

        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });
        outside.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        outside.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
        expect(onClose).toHaveBeenLastCalledWith('outside');
        expect(popover.isOpen()).toBe(false);
        popover.dispose();
    });

    it('uses the anchored Surface lifecycle without trapping focus and restores its trigger after Escape', () => {
        const anchor = document.createElement('button');
        document.body.appendChild(anchor);
        anchor.focus();
        const onClose = vi.fn();
        const popover = new InputEnhancementPopover({
            onChange: vi.fn(),
            onClose,
            onOpenGuide: vi.fn(),
        });
        popover.open({
            anchor,
            settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        });

        const root = popover.host.shadowRoot!.querySelector<HTMLElement>('.input-enhancement-popover')!;
        expect(root.dataset.motionState).toBe('opening');
        expect(root.style.getPropertyValue('--_surface-motion-open-duration')).toBe('180ms');

        const enabled = popover.host.shadowRoot!
            .querySelector<HTMLInputElement>('[data-role="input-enhancement-enabled"]')!;
        enabled.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            composed: true,
            cancelable: true,
        }));

        expect(popover.isOpen()).toBe(false);
        expect(onClose).toHaveBeenCalledWith('escape');
        root.dispatchEvent(new Event('animationend'));
        expect(popover.host.hidden).toBe(true);
        expect(document.activeElement).toBe(anchor);
        popover.dispose();
    });
});
