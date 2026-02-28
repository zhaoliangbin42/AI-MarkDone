import type { Theme } from '../../../core/types/theme';
import type { SiteAdapter } from '../adapters/base';

export type ThemeListener = (theme: Theme) => void;

export class ThemeManager {
    private observer: MutationObserver | null = null;
    private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
    private theme: Theme = 'light';
    private listeners = new Set<ThemeListener>();

    init(adapter: SiteAdapter | null): void {
        this.theme = this.detect(adapter);
        this.apply(this.theme);
        this.start(adapter);
    }

    subscribe(listener: ThemeListener): () => void {
        this.listeners.add(listener);
        listener(this.theme);
        return () => this.listeners.delete(listener);
    }

    private detect(adapter: SiteAdapter | null): Theme {
        const detector = adapter?.getThemeDetector();
        const detected = detector?.detect() || null;
        if (detected) return detected;

        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    private apply(theme: Theme): void {
        document.documentElement.setAttribute('data-aimd-theme', theme);
    }

    private notify(theme: Theme): void {
        this.listeners.forEach((l) => l(theme));
    }

    private start(adapter: SiteAdapter | null): void {
        const detector = adapter?.getThemeDetector();

        if (this.observer) this.observer.disconnect();
        this.observer = new MutationObserver(() => {
            const next = this.detect(adapter);
            if (next !== this.theme) {
                this.theme = next;
                this.apply(next);
                this.notify(next);
            }
        });

        if (detector) {
            for (const { element, attributes } of detector.getObserveTargets()) {
                const el = element === 'html' ? document.documentElement : document.body;
                if (!el) continue;
                this.observer.observe(el, { attributes: true, attributeFilter: attributes });
            }
        } else {
            this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        }

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        this.mediaQueryListener = () => {
            const next = this.detect(adapter);
            if (next !== this.theme) {
                this.theme = next;
                this.apply(next);
                this.notify(next);
            }
        };
        mq.addEventListener('change', this.mediaQueryListener);
    }
}

