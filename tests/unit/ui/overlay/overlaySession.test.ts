import { afterEach, describe, expect, it, vi } from 'vitest';

import { OverlaySession } from '@/ui/content/overlay/OverlaySession';

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
});
