export type VisualHarnessTheme = 'light' | 'dark';
export type VisualHarnessLocale = 'en' | 'zh_CN';

export type VisualHarnessVariant = {
    theme: VisualHarnessTheme;
    locale: VisualHarnessLocale;
};

export type VisualHarnessSurfaceExpectation = {
    role: string;
    count: number;
};

export type VisualHarnessState = {
    theme: VisualHarnessTheme;
    locale: VisualHarnessLocale;
    expectedOpenSurfaces: VisualHarnessSurfaceExpectation[];
    localeEvidence: string;
};

export type VisualHarnessBridge = {
    applyVariant(variant: VisualHarnessVariant): void | Promise<void>;
    prepareForAudit(): void | Promise<void>;
    getState(): VisualHarnessState;
};

declare global {
    interface Window {
        __AIMD_VISUAL_HARNESS__?: VisualHarnessBridge;
    }
}

export function installVisualHarnessBridge(bridge: VisualHarnessBridge): void {
    window.__AIMD_VISUAL_HARNESS__ = bridge;
}

export function isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    return rect.width > 0
        && rect.height > 0
        && rect.right > 0
        && rect.bottom > 0
        && rect.left < viewportWidth
        && rect.top < viewportHeight;
}
