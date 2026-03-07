import { describe, expect, it } from 'vitest';

import { mountShadowDialogHost } from '@/ui/content/components/shadowDialogHost';

describe('mountShadowDialogHost', () => {
    it('mounts a host with a single style element and releases scroll lock on unmount', () => {
        document.documentElement.style.overflow = 'auto';
        document.body.style.overflow = 'scroll';

        const h = mountShadowDialogHost({
            id: 'test-shadow-dialog-host',
            html: '<div data-role="content">Hello</div>',
            cssText: ':host{color:red;}',
            lockScroll: true,
        });

        expect(document.getElementById('test-shadow-dialog-host')).toBeTruthy();
        expect(h.shadow.querySelectorAll('style').length).toBe(1);
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');

        h.setCss(':host{color:blue;}');
        expect(h.styleEl.textContent).toContain('color:blue');

        h.unmount();
        expect(document.getElementById('test-shadow-dialog-host')).toBeFalsy();
        expect(document.documentElement.style.overflow).toBe('auto');
        expect(document.body.style.overflow).toBe('scroll');
    });
});

