import { describe, expect, it, vi } from 'vitest';
import { ensureStyle } from '@/style/shadow';

describe('shadow style registry', () => {
    it('reuses a root-scoped style node when the same id is ensured twice', () => {
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });

        ensureStyle(shadow, '.alpha { color: red; }', { id: 'tokens' });
        ensureStyle(shadow, '.beta { color: blue; }', { id: 'tokens' });

        const styles = shadow.querySelectorAll('style[data-aimd-style-id="tokens"]');
        expect(styles).toHaveLength(1);
        expect(styles[0]?.textContent).toContain('.beta');
        expect(styles[0]?.textContent).not.toContain('.alpha');
    });

    it('shares a constructed stylesheet across roots when shared caching is requested', () => {
        class FakeSheet {
            cssText = '';

            replaceSync(text: string): void {
                this.cssText = text;
            }
        }

        const originalSheet = (globalThis as any).CSSStyleSheet;
        (globalThis as any).CSSStyleSheet = FakeSheet;

        const hostA = document.createElement('div');
        const hostB = document.createElement('div');
        const shadowA = hostA.attachShadow({ mode: 'open' });
        const shadowB = hostB.attachShadow({ mode: 'open' });

        Object.defineProperty(shadowA, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
        Object.defineProperty(shadowB, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });

        try {
            ensureStyle(shadowA, '.shared { color: red; }', { id: 'toolbar-base', cache: 'shared' });
            ensureStyle(shadowB, '.shared { color: red; }', { id: 'toolbar-base', cache: 'shared' });

            expect((shadowA as any).adoptedStyleSheets).toHaveLength(1);
            expect((shadowB as any).adoptedStyleSheets).toHaveLength(1);
            expect((shadowA as any).adoptedStyleSheets[0]).toBe((shadowB as any).adoptedStyleSheets[0]);
        } finally {
            (globalThis as any).CSSStyleSheet = originalSheet;
        }
    });

    it('falls back to root-scoped style tags when shared caching is requested but constructed stylesheets are unavailable', () => {
        const originalSheet = (globalThis as any).CSSStyleSheet;
        (globalThis as any).CSSStyleSheet = undefined;

        const hostA = document.createElement('div');
        const hostB = document.createElement('div');
        const shadowA = hostA.attachShadow({ mode: 'open' });
        const shadowB = hostB.attachShadow({ mode: 'open' });

        try {
            ensureStyle(shadowA, '.shared { color: red; }', { id: 'overlay-base', cache: 'shared' });
            ensureStyle(shadowB, '.shared { color: red; }', { id: 'overlay-base', cache: 'shared' });

            expect(shadowA.querySelectorAll('style[data-aimd-style-id="overlay-base"]')).toHaveLength(1);
            expect(shadowB.querySelectorAll('style[data-aimd-style-id="overlay-base"]')).toHaveLength(1);
        } finally {
            (globalThis as any).CSSStyleSheet = originalSheet;
        }
    });

    it('falls back to root-scoped style tags when adoptedStyleSheets is not an array', () => {
        class FakeSheet {
            replaceSync = vi.fn();
        }

        const originalSheet = (globalThis as any).CSSStyleSheet;
        (globalThis as any).CSSStyleSheet = FakeSheet;

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        Object.defineProperty(shadow, 'adoptedStyleSheets', {
            configurable: true,
            writable: true,
            value: { length: 0 },
        });

        try {
            expect(() => {
                ensureStyle(shadow, '.firefox { color: red; }', { id: 'toolbar-base', cache: 'shared' });
            }).not.toThrow();

            const styles = shadow.querySelectorAll('style[data-aimd-style-id="toolbar-base"]');
            expect(styles).toHaveLength(1);
            expect(styles[0]?.textContent).toContain('.firefox');
        } finally {
            (globalThis as any).CSSStyleSheet = originalSheet;
        }
    });

    it('falls back to root-scoped style tags when adoptedStyleSheets lacks membership helpers', () => {
        class FakeSheet {
            replaceSync = vi.fn();
        }

        const originalSheet = (globalThis as any).CSSStyleSheet;
        (globalThis as any).CSSStyleSheet = FakeSheet;

        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        const sheets: unknown[] = [];
        Object.defineProperty(sheets, 'some', {
            configurable: true,
            value: undefined,
        });
        Object.defineProperty(shadow, 'adoptedStyleSheets', {
            configurable: true,
            writable: true,
            value: sheets,
        });

        try {
            expect(() => {
                ensureStyle(shadow, '.firefox-array { color: red; }', { id: 'toolbar-base', cache: 'shared' });
            }).not.toThrow();

            const styles = shadow.querySelectorAll('style[data-aimd-style-id="toolbar-base"]');
            expect(styles).toHaveLength(1);
            expect(styles[0]?.textContent).toContain('.firefox-array');
        } finally {
            (globalThis as any).CSSStyleSheet = originalSheet;
        }
    });

    it('does not retain an unreferenced shared sheet when adoption fails', () => {
        class FakeSheet {
            static replaceCount = 0;

            replaceSync(): void {
                FakeSheet.replaceCount += 1;
            }
        }

        const originalSheet = (globalThis as any).CSSStyleSheet;
        (globalThis as any).CSSStyleSheet = FakeSheet;
        const rejectedShadow = document.createElement('div').attachShadow({ mode: 'open' });
        Object.defineProperty(rejectedShadow, 'adoptedStyleSheets', {
            configurable: true,
            get: () => [],
            set: () => {
                throw new Error('adoption rejected');
            },
        });

        try {
            ensureStyle(rejectedShadow, '.shared-failure { color: red; }', {
                id: 'shared-failure-a',
                cache: 'shared',
                sharedKey: 'shared-failure',
            });
            expect(rejectedShadow.querySelectorAll('style[data-aimd-style-id="shared-failure-a"]')).toHaveLength(1);

            const healthyShadow = document.createElement('div').attachShadow({ mode: 'open' });
            Object.defineProperty(healthyShadow, 'adoptedStyleSheets', {
                configurable: true,
                writable: true,
                value: [],
            });
            ensureStyle(healthyShadow, '.shared-failure { color: red; }', {
                id: 'shared-failure-b',
                cache: 'shared',
                sharedKey: 'shared-failure',
            });

            expect(FakeSheet.replaceCount).toBe(2);
        } finally {
            (globalThis as any).CSSStyleSheet = originalSheet;
        }
    });
});
