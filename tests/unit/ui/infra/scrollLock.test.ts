import { describe, expect, it } from 'vitest';

import { acquireScrollLock } from '@/ui/content/components/scrollLock';

describe('ScrollLock', () => {
    it('is ref-counted and restores overflow only on last release', () => {
        document.documentElement.style.overflow = 'auto';
        document.body.style.overflow = 'scroll';

        const a = acquireScrollLock();
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');

        const b = acquireScrollLock();
        a.release();
        expect(document.documentElement.style.overflow).toBe('hidden');
        expect(document.body.style.overflow).toBe('hidden');

        b.release();
        expect(document.documentElement.style.overflow).toBe('auto');
        expect(document.body.style.overflow).toBe('scroll');
    });
});

