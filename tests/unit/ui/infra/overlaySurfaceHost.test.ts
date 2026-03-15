import { describe, expect, it } from 'vitest';

import { mountOverlaySurfaceHost } from '@/ui/content/overlay/OverlaySurfaceHost';

describe('mountOverlaySurfaceHost', () => {
    it('mounts a shared overlay surface with dedicated backdrop, surface, and modal slots', () => {
        const handle = mountOverlaySurfaceHost({
            id: 'test-overlay-surface-host',
            themeCss: ':host{color:red;}',
            surfaceCss: '.surface { color: blue; }',
            overlayCss: '.tw\\:bg-surface { background: var(--aimd-bg-primary); }',
            lockScroll: true,
        });

        expect(document.getElementById('test-overlay-surface-host')).toBeTruthy();
        expect(handle.backdropRoot.dataset.role).toBe('overlay-backdrop-root');
        expect(handle.surfaceRoot.dataset.role).toBe('overlay-surface-root');
        expect(handle.modalRoot.dataset.role).toBe('overlay-modal-root');
        expect(handle.shadow.querySelector('style')?.textContent).toContain('color:red');
        expect(handle.shadow.querySelector('[data-aimd-style-id="aimd-overlay-surface-structure"]')?.textContent).toContain('.surface');
        expect(handle.shadow.querySelector('[data-aimd-style-id="aimd-overlay-surface-tailwind"]')).toBeTruthy();

        handle.setThemeCss(':host{color:green;}');
        expect(handle.shadow.querySelector('style')?.textContent).toContain('color:green');

        handle.unmount();
        expect(document.getElementById('test-overlay-surface-host')).toBeFalsy();
    });
});
