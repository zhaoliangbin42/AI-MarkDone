import { describe, expect, it } from 'vitest';

import {
    eventWithinTransientRoot,
    markTransientRoot,
    TRANSIENT_ROOT_ATTR,
} from '@/ui/content/components/transientUi';

describe('transientUi', () => {
    it('marks transient roots with a shared attribute', () => {
        const root = markTransientRoot(document.createElement('div'));
        expect(root.getAttribute(TRANSIENT_ROOT_ATTR)).toBe('1');
    });

    it('detects events within a transient root using composedPath', () => {
        const root = markTransientRoot(document.createElement('div'));
        const child = document.createElement('button');
        root.appendChild(child);

        const event = new MouseEvent('pointerdown', { bubbles: true, composed: true });
        Object.defineProperty(event, 'composedPath', {
            value: () => [child, root, document.body, document, window],
        });

        expect(eventWithinTransientRoot(event)).toBe(true);
    });
});
