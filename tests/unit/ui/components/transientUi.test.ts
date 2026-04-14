import { describe, expect, it, vi } from 'vitest';

import {
    eventWithinTransientRoot,
    installTransientOutsideDismissBoundary,
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

    it('does not dismiss when a pointer interaction starts inside a transient root and clicks outside', () => {
        const transient = markTransientRoot(document.createElement('div'));
        const outside = document.createElement('button');
        document.body.append(transient, outside);
        const onDismiss = vi.fn();
        const boundary = installTransientOutsideDismissBoundary({
            eventTarget: document,
            onDismiss,
        });

        try {
            transient.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

            expect(onDismiss).not.toHaveBeenCalled();
        } finally {
            boundary.detach();
            transient.remove();
            outside.remove();
        }
    });

    it('dismisses when pointerdown and click both happen outside transient roots', () => {
        const outside = document.createElement('button');
        document.body.appendChild(outside);
        const onDismiss = vi.fn();
        const boundary = installTransientOutsideDismissBoundary({
            eventTarget: document,
            onDismiss,
        });

        try {
            outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

            expect(onDismiss).toHaveBeenCalledTimes(1);
        } finally {
            boundary.detach();
            outside.remove();
        }
    });

    it('does not dismiss when a click lands inside a transient root', () => {
        const transient = markTransientRoot(document.createElement('div'));
        const outside = document.createElement('button');
        document.body.append(transient, outside);
        const onDismiss = vi.fn();
        const boundary = installTransientOutsideDismissBoundary({
            eventTarget: document,
            onDismiss,
        });

        try {
            outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            transient.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

            expect(onDismiss).not.toHaveBeenCalled();
        } finally {
            boundary.detach();
            transient.remove();
            outside.remove();
        }
    });

    it('treats configured roots as inside boundaries', () => {
        const root = document.createElement('div');
        const child = document.createElement('button');
        const outside = document.createElement('button');
        root.appendChild(child);
        document.body.append(root, outside);
        const onDismiss = vi.fn();
        const boundary = installTransientOutsideDismissBoundary({
            eventTarget: document,
            roots: [root],
            onDismiss,
        });

        try {
            child.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
            outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

            expect(onDismiss).not.toHaveBeenCalled();
        } finally {
            boundary.detach();
            root.remove();
            outside.remove();
        }
    });
});
