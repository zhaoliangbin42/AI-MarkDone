import { afterEach, describe, expect, it, vi } from 'vitest';

import { OverlaySession } from '@/ui/content/overlay/OverlaySession';
import { createAppearanceSnapshot } from '@/style/appearance';

describe('OverlaySession', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        document.getElementById('aimd-test-overlay-host')?.remove();
    });

    it('mounts backdrop/surface/modal slots and localizes panel and modal input events', async () => {
        const session = new OverlaySession({
            id: 'aimd-test-overlay-host',
            theme: 'light',
            surfaceCss: '.test-surface { display:block; }',
            lockScroll: true,
            surfaceStyleId: 'aimd-test-surface-style',
            overlayStyleId: 'aimd-test-overlay-style',
        });

        const backdrop = document.createElement('div');
        backdrop.className = 'panel-stage__overlay';
        const surface = document.createElement('div');
        surface.className = 'test-surface';
        const input = document.createElement('input');
        surface.appendChild(input);

        session.replaceBackdrop(backdrop);
        session.replaceSurface(surface);

        const documentInput = vi.fn();
        const documentFocusIn = vi.fn();
        document.addEventListener('input', documentInput);
        document.addEventListener('focusin', documentFocusIn);

        try {
            input.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

            expect(documentFocusIn).not.toHaveBeenCalled();
            expect(documentInput).not.toHaveBeenCalled();
            expect(session.shadow.querySelector('[data-role="overlay-backdrop-root"] .panel-stage__overlay')).toBeTruthy();
            expect(session.shadow.querySelector('[data-role="overlay-surface-root"] .test-surface')).toBeTruthy();
            expect(session.modalRoot.querySelector('.mock-modal-host')).toBeTruthy();
        } finally {
            document.removeEventListener('input', documentInput);
            document.removeEventListener('focusin', documentFocusIn);
            session.unmount();
        }
    });

    it('keeps Escape and real pointerdown-to-click dismissal live until unmount, then releases them', () => {
        const session = new OverlaySession({
            id: 'aimd-test-overlay-host',
            theme: 'light',
            surfaceCss: '.test-surface { display:block; }',
            surfaceStyleId: 'aimd-test-surface-style',
            overlayStyleId: 'aimd-test-overlay-style',
        });
        const backdrop = document.createElement('div');
        backdrop.className = 'panel-stage__overlay';
        const surface = document.createElement('div');
        surface.className = 'test-surface';
        surface.tabIndex = -1;
        session.replaceBackdrop(backdrop);
        session.replaceSurface(surface);
        const onEscape = vi.fn();
        const onBackdropDismiss = vi.fn();

        session.syncKeyboardScope({ root: surface, onEscape });
        session.syncBackdropDismiss(onBackdropDismiss);

        surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(onBackdropDismiss).toHaveBeenCalledTimes(1);

        session.unmount();
        surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(onBackdropDismiss).toHaveBeenCalledTimes(1);
    });

    it('applies appearance through the shared ShadowRoot scope and suppresses an equivalent snapshot', () => {
        const session = new OverlaySession({
            id: 'aimd-test-overlay-host',
            theme: 'light',
            surfaceCss: '.test-surface { display:block; }',
            surfaceStyleId: 'aimd-test-surface-style',
            overlayStyleId: 'aimd-test-overlay-style',
        });
        try {
            const initialStyle = session.shadow.querySelector<HTMLStyleElement>(
                '[data-aimd-style-id="aimd-appearance-tokens"]',
            );
            expect(initialStyle).toBeTruthy();
            const initialCss = initialStyle?.textContent;

            session.setAppearance(createAppearanceSnapshot('light', {}));
            expect(initialStyle?.textContent).toBe(initialCss);

            session.setAppearance(createAppearanceSnapshot('dark', {}));
            expect(initialStyle?.textContent).not.toBe(initialCss);
            expect(session.handle).not.toHaveProperty('setThemeCss');
        } finally {
            session.unmount();
        }
    });
});
