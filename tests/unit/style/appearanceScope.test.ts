import { afterEach, describe, expect, it } from 'vitest';
import { createAppearanceSnapshot } from '@/style/appearance';
import { AppearanceScope } from '@/style/appearanceScope';

describe('AppearanceScope', () => {
    afterEach(() => {
        document.getElementById('aimd-page-token-vars-test')?.remove();
    });

    it('writes a page snapshot once when normalized appearance is unchanged', () => {
        const scope = AppearanceScope.forPage(document, {
            styleId: 'aimd-page-token-vars-test',
        });

        expect(scope.apply(createAppearanceSnapshot('light', { accentColor: '#0A7' }))).toBe(true);
        const style = document.getElementById('aimd-page-token-vars-test');
        expect(style).toBeInstanceOf(HTMLStyleElement);
        expect(style?.textContent).not.toContain(':root[data-aimd-theme="light"]');

        expect(scope.apply(createAppearanceSnapshot('light', { accentColor: '#00aa77' }))).toBe(false);
        expect(document.getElementById('aimd-page-token-vars-test')).toBe(style);

        scope.dispose();
        expect(document.getElementById('aimd-page-token-vars-test')).toBeNull();
    });

    it('shares one constructed token sheet across ShadowRoots and releases it after the last scope', () => {
        class FakeSheet {
            static replaceCount = 0;

            replaceSync(): void {
                FakeSheet.replaceCount += 1;
            }
        }

        const originalSheet = (globalThis as any).CSSStyleSheet;
        (globalThis as any).CSSStyleSheet = FakeSheet;
        const shadowA = document.createElement('div').attachShadow({ mode: 'open' });
        const shadowB = document.createElement('div').attachShadow({ mode: 'open' });
        Object.defineProperty(shadowA, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
        Object.defineProperty(shadowB, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });

        try {
            const scopeA = AppearanceScope.forShadowRoot(shadowA, { styleId: 'aimd-token-test-a' });
            const scopeB = AppearanceScope.forShadowRoot(shadowB, { styleId: 'aimd-token-test-b' });
            const snapshot = createAppearanceSnapshot('dark', { baseFontScale: 1.1 });

            expect(scopeA.apply(snapshot)).toBe(true);
            expect(scopeB.apply(snapshot)).toBe(true);
            expect(shadowA.adoptedStyleSheets[0]).toBe(shadowB.adoptedStyleSheets[0]);
            expect(FakeSheet.replaceCount).toBe(1);
            expect(scopeA.apply(createAppearanceSnapshot('dark', { baseFontScale: 1.1 }))).toBe(false);
            expect(FakeSheet.replaceCount).toBe(1);

            scopeA.dispose();
            scopeB.dispose();
            expect(shadowA.adoptedStyleSheets).toEqual([]);
            expect(shadowB.adoptedStyleSheets).toEqual([]);

            const shadowC = document.createElement('div').attachShadow({ mode: 'open' });
            Object.defineProperty(shadowC, 'adoptedStyleSheets', { configurable: true, writable: true, value: [] });
            const scopeC = AppearanceScope.forShadowRoot(shadowC, { styleId: 'aimd-token-test-c' });
            scopeC.apply(snapshot);
            expect(FakeSheet.replaceCount).toBe(2);
            scopeC.dispose();
        } finally {
            (globalThis as any).CSSStyleSheet = originalSheet;
        }
    });

    it('scopes light-DOM portal tokens to its unique host selector', () => {
        const host = document.createElement('div');
        host.className = 'aimd-test-portal';
        document.body.appendChild(host);
        const scope = AppearanceScope.forLightDomPortal(host, {
            selector: '.aimd-test-portal',
            styleId: 'aimd-portal-token-test',
        });

        expect(scope.apply(createAppearanceSnapshot('dark', { accentColor: '#0A7' }))).toBe(true);
        const style = document.getElementById('aimd-portal-token-test');
        expect(style?.textContent).toContain('.aimd-test-portal[data-aimd-theme="light"]');
        expect(style?.textContent).toContain('.aimd-test-portal[data-aimd-theme="dark"]');
        expect(style?.textContent).not.toContain(':host');
        expect(host.dataset.aimdTheme).toBe('dark');

        expect(scope.apply(createAppearanceSnapshot('dark', { accentColor: '#00aa77' }))).toBe(false);
        scope.dispose();
        expect(document.getElementById('aimd-portal-token-test')).toBeNull();
        expect(host.hasAttribute('data-aimd-theme')).toBe(false);
        host.remove();
    });
});
