import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeManager } from '@/drivers/content/theme/theme-manager';

class TestMutationObserver {
    static instances: TestMutationObserver[] = [];

    readonly observe = vi.fn();
    readonly disconnect = vi.fn();
    readonly takeRecords = vi.fn(() => [] as MutationRecord[]);

    constructor(readonly callback: MutationCallback) {
        TestMutationObserver.instances.push(this);
    }
}

afterEach(() => {
    TestMutationObserver.instances = [];
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-aimd-theme');
});

describe('ThemeManager lifecycle', () => {
    it('disconnects its observer, removes its media listener, and clears subscribers on dispose', () => {
        let mediaMatches = false;
        let mediaChangeListener: ((event: MediaQueryListEvent) => void) | null = null;
        const mediaQuery = {
            get matches() {
                return mediaMatches;
            },
            media: '(prefers-color-scheme: dark)',
            onchange: null,
            addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
                if (type === 'change' && typeof listener === 'function') {
                    mediaChangeListener = listener as (event: MediaQueryListEvent) => void;
                }
            }),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        };
        vi.stubGlobal('MutationObserver', TestMutationObserver);
        vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery as unknown as MediaQueryList));

        const manager = new ThemeManager();
        const listener = vi.fn();
        manager.init(null);
        manager.subscribe(listener);

        const observer = TestMutationObserver.instances[0];
        const retainedMediaListener = mediaChangeListener;
        expect(observer).toBeDefined();
        expect(retainedMediaListener).not.toBeNull();
        expect(listener).toHaveBeenCalledOnce();

        manager.dispose();

        expect(observer.disconnect).toHaveBeenCalledOnce();
        expect(mediaQuery.removeEventListener).toHaveBeenCalledOnce();
        expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', retainedMediaListener);

        document.documentElement.setAttribute('data-theme', 'dark');
        observer.callback([], observer as unknown as MutationObserver);
        mediaMatches = true;
        retainedMediaListener?.({ matches: true } as MediaQueryListEvent);
        expect(listener).toHaveBeenCalledOnce();
    });
});
