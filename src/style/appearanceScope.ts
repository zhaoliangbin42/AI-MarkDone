import type { AppearanceSnapshot } from './appearance';
import { ensureStyle, removeStyle } from './shadow';
import { getPageTokenCss, getTokenCss, type UserThemeOverrides } from './tokens';

type PageAppearanceScopeOptions = {
    styleId?: string;
};

type ShadowAppearanceScopeOptions = {
    styleId?: string;
};

type LightDomPortalAppearanceScopeOptions = {
    selector: string;
    styleId: string;
};

type AppearanceTarget =
    | { kind: 'page'; ownerDocument: Document; styleId: string }
    | { kind: 'shadow-root'; root: ShadowRoot; styleId: string }
    | { kind: 'light-dom-portal'; host: HTMLElement; selector: string; styleId: string };

const DEFAULT_PAGE_STYLE_ID = 'aimd-page-token-vars';
const DEFAULT_SHADOW_STYLE_ID = 'aimd-appearance-tokens';

function replaceHostScope(css: string, selector: string): string {
    return css.replace(/:host/g, selector);
}

export function getLightDomPortalTokenCss(
    selector: string,
    overrides: UserThemeOverrides = {},
): string {
    const normalizedSelector = selector.trim();
    if (!normalizedSelector || /[{}]/.test(normalizedSelector)) {
        throw new Error('Light-DOM appearance scope requires a non-empty selector without rule delimiters.');
    }
    const light = replaceHostScope(
        getTokenCss('light', overrides),
        `${normalizedSelector}[data-aimd-theme="light"]`,
    );
    const dark = replaceHostScope(
        getTokenCss('dark', overrides),
        `${normalizedSelector}[data-aimd-theme="dark"]`,
    );
    return `${light}\n${dark}`;
}

export class AppearanceScope {
    private lastFingerprint: string | null = null;
    private lastTheme: AppearanceSnapshot['theme'] | null = null;
    private appliedStyle: HTMLStyleElement | CSSStyleSheet | null = null;

    private constructor(private readonly target: AppearanceTarget) {}

    static forPage(
        ownerDocument: Document,
        options: PageAppearanceScopeOptions = {},
    ): AppearanceScope {
        return new AppearanceScope({
            kind: 'page',
            ownerDocument,
            styleId: options.styleId ?? DEFAULT_PAGE_STYLE_ID,
        });
    }

    static forShadowRoot(
        root: ShadowRoot,
        options: ShadowAppearanceScopeOptions = {},
    ): AppearanceScope {
        return new AppearanceScope({
            kind: 'shadow-root',
            root,
            styleId: options.styleId ?? DEFAULT_SHADOW_STYLE_ID,
        });
    }

    static forLightDomPortal(
        host: HTMLElement,
        options: LightDomPortalAppearanceScopeOptions,
    ): AppearanceScope {
        return new AppearanceScope({
            kind: 'light-dom-portal',
            host,
            selector: options.selector.trim(),
            styleId: options.styleId,
        });
    }

    apply(snapshot: AppearanceSnapshot): boolean {
        if (this.lastFingerprint === snapshot.fingerprint && this.isApplied()) return false;

        if (this.target.kind === 'shadow-root') {
            this.appliedStyle = ensureStyle(
                this.target.root,
                getTokenCss(snapshot.theme, snapshot.overrides),
                { id: this.target.styleId, cache: 'shared', sharedKey: DEFAULT_SHADOW_STYLE_ID },
            );
            this.lastFingerprint = snapshot.fingerprint;
            this.lastTheme = snapshot.theme;
            return true;
        }

        const ownerDocument = this.target.kind === 'page'
            ? this.target.ownerDocument
            : this.target.host.ownerDocument;
        const { styleId } = this.target;
        const current = ownerDocument.getElementById(styleId);
        if (current && !(current instanceof HTMLStyleElement)) {
            throw new Error(`Appearance style id is already owned by a non-style element: ${styleId}`);
        }

        const style = current ?? ownerDocument.createElement('style');
        if (!style.isConnected) {
            style.id = styleId;
            (ownerDocument.head || ownerDocument.documentElement).appendChild(style);
        }
        if (this.target.kind === 'light-dom-portal') {
            this.target.host.setAttribute('data-aimd-theme', snapshot.theme);
            style.textContent = getLightDomPortalTokenCss(this.target.selector, snapshot.overrides);
        } else {
            style.textContent = getPageTokenCss(snapshot.overrides);
        }
        style.dataset.aimdAppearanceFingerprint = snapshot.fingerprint;
        this.lastFingerprint = snapshot.fingerprint;
        this.lastTheme = snapshot.theme;
        this.appliedStyle = style;
        return true;
    }

    dispose(): void {
        if (this.target.kind === 'shadow-root') {
            removeStyle(this.target.root, this.target.styleId);
        } else {
            if (this.target.kind === 'light-dom-portal') {
                this.target.host.removeAttribute('data-aimd-theme');
            }
            if (this.appliedStyle instanceof HTMLStyleElement) this.appliedStyle.remove();
        }
        this.appliedStyle = null;
        this.lastFingerprint = null;
        this.lastTheme = null;
    }

    private isApplied(): boolean {
        if (!this.appliedStyle) return false;
        if (this.target.kind !== 'shadow-root') {
            const portalThemeMatches = this.target.kind === 'page'
                || this.target.host.dataset.aimdTheme === this.lastTheme;
            return this.appliedStyle instanceof HTMLStyleElement
                && this.appliedStyle.isConnected
                && this.appliedStyle.dataset.aimdAppearanceFingerprint === this.lastFingerprint
                && portalThemeMatches;
        }
        if (this.appliedStyle instanceof HTMLStyleElement) {
            return this.appliedStyle.getRootNode() === this.target.root;
        }
        return this.target.root.adoptedStyleSheets.includes(this.appliedStyle);
    }
}
