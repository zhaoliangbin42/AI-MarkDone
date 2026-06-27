import { describe, expect, it, vi } from 'vitest';

import { attachDialogKeyboardScope } from '@/ui/content/components/dialogKeyboardScope';
import { markTransientRoot } from '@/ui/content/components/transientUi';

describe('attachDialogKeyboardScope', () => {
    it('calls onEscape and ignores composing ESC', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        const onEscape = vi.fn();
        const handle = attachDialogKeyboardScope({ root, onEscape });

        const composing = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        Object.defineProperty(composing, 'isComposing', { value: true });
        root.dispatchEvent(composing);
        expect(onEscape).toHaveBeenCalledTimes(0);

        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        root.dispatchEvent(esc);
        expect(onEscape).toHaveBeenCalledTimes(1);

        handle.detach();
        root.remove();
    });

    it('traps Tab within a container when configured', () => {
        const root = document.createElement('div');
        const container = document.createElement('div');
        root.appendChild(container);

        const a = document.createElement('button');
        a.textContent = 'a';
        const b = document.createElement('button');
        b.textContent = 'b';
        container.append(a, b);
        document.body.appendChild(root);

        const handle = attachDialogKeyboardScope({ root, onEscape: () => {}, trapTabWithin: container });

        a.focus();
        const tabBack = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
        container.dispatchEvent(tabBack);
        expect(document.activeElement).toBe(b);

        b.focus();
        const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        container.dispatchEvent(tabForward);
        expect(document.activeElement).toBe(a);

        handle.detach();
        root.remove();
    });

    it('repairs focus back into the root when focus escapes (focusin/mutations)', async () => {
        const root = document.createElement('div');
        root.tabIndex = -1;
        root.appendChild(document.createElement('div'));
        document.body.appendChild(root);

        const outside = document.createElement('button');
        outside.textContent = 'outside';
        document.body.appendChild(outside);

        const handle = attachDialogKeyboardScope({ root, onEscape: () => {} });

        // Escape focus and ensure we get pulled back in.
        outside.focus();
        await Promise.resolve();
        expect(document.activeElement).toBe(root);

        // Escape focus again, then trigger a mutation inside root; mutation observer should repair focus.
        outside.focus();
        root.appendChild(document.createElement('span'));
        await Promise.resolve();
        expect(document.activeElement).toBe(root);

        handle.detach();
        root.remove();
        outside.remove();
    });

    it('does not steal focus from a shared transient popover outside the root', async () => {
        const root = document.createElement('div');
        root.tabIndex = -1;
        const panelInput = document.createElement('input');
        root.appendChild(panelInput);
        document.body.appendChild(root);

        const transient = markTransientRoot(document.createElement('div'));
        const promptInput = document.createElement('input');
        transient.appendChild(promptInput);
        document.body.appendChild(transient);

        const handle = attachDialogKeyboardScope({ root, onEscape: () => {} });

        promptInput.focus();
        promptInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
        await Promise.resolve();

        expect(document.activeElement).toBe(promptInput);

        root.appendChild(document.createElement('span'));
        await Promise.resolve();

        expect(document.activeElement).toBe(promptInput);

        handle.detach();
        root.remove();
        transient.remove();
    });
});
