import type { LatexSnippetItem } from '../../../core/math/latexSnippets';
import type { FormulaSvgAsset } from '../../../core/math/formulaAssetTypes';
import type { MarkdownMathKind } from '../../../core/sending/markdownMath';
import { ensureStyle } from '../../../style/shadow';
import {
    areAppearanceSnapshotsEqual,
    createAppearanceSnapshot,
    type AppearanceSnapshot,
} from '../../../style/appearance';
import { AppearanceScope } from '../../../style/appearanceScope';
import { getLocale, subscribeLocaleChange, t, type UiLocale } from './i18n';
import { markTransientRoot } from './transientUi';
import {
    COMPOSER_SUGGESTION_LIST_CSS,
    renderComposerSuggestionList,
} from './ComposerSuggestionList';
import {
    getDefaultSurfaceMotionProfile,
    SurfaceSession,
    type ResponsiveProfile,
    type SurfacePositioner,
} from './SurfaceRuntime';
import { getAnchoredMotionCss } from './styles/anchoredMotionCss';

export type FormulaPreviewState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; asset: FormulaSvgAsset };

export type FormulaComposerAssistantView = {
    anchorRect: DOMRect;
    mathKind: MarkdownMathKind;
    preview: FormulaPreviewState | null;
    suggestions: readonly LatexSnippetItem[];
    selectedIndex: number;
};

export type FormulaComposerAssistantDismissReason = 'escape' | 'outside';

const CSS = `
:host {
  box-sizing: border-box;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
* { box-sizing: border-box; }
.formula-assistant {
  width: 100%;
  min-width: 0;
  display: grid;
  overflow: hidden;
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-panel);
}
.formula-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-bottom: 1px solid var(--aimd-border-subtle);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.formula-preview-kind {
  font-family: var(--aimd-font-family-mono);
}
.formula-preview {
  min-height: var(--aimd-size-control-action-panel);
  max-height: min(220px, 40vh);
  display: grid;
  place-items: center;
  overflow: auto;
  padding: var(--aimd-space-4);
  color: var(--aimd-text-primary);
  background: var(--aimd-bg-secondary);
}
.formula-preview svg {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 180px;
  color: currentColor;
}
.formula-preview-status {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.formula-preview-status[data-state="error"] {
  color: var(--aimd-color-danger);
}
.formula-suggestions {
  min-height: 0;
}
.formula-assistant[data-has-preview="1"] .formula-suggestions {
  border-top: 1px solid var(--aimd-border-subtle);
}
${COMPOSER_SUGGESTION_LIST_CSS}
@media (prefers-reduced-motion: reduce) {
  .formula-assistant { transition: none; }
}
`;

const RESPONSIVE_PROFILE: ResponsiveProfile = {
    viewportGutterPx: 16,
    maxWidthCss: '520px',
    maxHeightCss: 'calc(100vh - var(--aimd-space-4) * 2)',
    collision: 'flip-clamp',
    scrollOwner: 'content',
    narrowFallback: 'compact',
};

function createPreviewSvg(asset: FormulaSvgAsset): SVGElement | null {
    const parsed = new DOMParser().parseFromString(asset.svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) return null;
    const svg = parsed.documentElement;
    if (svg.localName !== 'svg') return null;
    svg.querySelectorAll<SVGElement>('[fill], [stroke]').forEach((element) => {
        for (const attribute of ['fill', 'stroke'] as const) {
            const value = element.getAttribute(attribute)?.trim().toLowerCase();
            if (value === '#000' || value === '#000000' || value === 'black') {
                element.setAttribute(attribute, 'currentColor');
            }
        }
    });
    return document.importNode(svg, true) as unknown as SVGElement;
}

export class FormulaComposerAssistantPopover {
    readonly host: HTMLElement;
    private readonly shadow: ShadowRoot;
    private readonly root: HTMLElement;
    private readonly appearanceScope: AppearanceScope;
    private readonly surfaceSession: SurfaceSession<AppearanceSnapshot, UiLocale>;
    private readonly unsubscribeLocale: () => void;
    private appearance: AppearanceSnapshot = createAppearanceSnapshot('light');
    private view: FormulaComposerAssistantView | null = null;
    private openState = false;

    constructor(private readonly params: {
        onSelect: (index: number) => void;
        onHover?: (index: number) => void;
        onDismiss?: (reason: FormulaComposerAssistantDismissReason) => void;
        getDismissRoots?: () => ReadonlyArray<HTMLElement | null | undefined>;
    }) {
        this.host = markTransientRoot(document.createElement('div'));
        this.host.dataset.aimdRole = 'formula-composer-assistant';
        this.host.dataset.aimdTheme = this.appearance.theme;
        this.host.style.position = 'fixed';
        this.host.style.left = '0px';
        this.host.style.top = '0px';
        this.host.style.zIndex = 'var(--aimd-z-tooltip)';
        this.host.hidden = true;
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.root = document.createElement('section');
        this.root.className = 'formula-assistant';
        this.root.setAttribute('role', 'region');
        this.root.dataset.aimdSurfaceProfile = 'anchored';
        this.shadow.appendChild(this.root);
        document.body.appendChild(this.host);
        this.appearanceScope = AppearanceScope.forShadowRoot(this.shadow, {
            styleId: 'aimd-formula-assistant-tokens',
        });
        this.appearanceScope.apply(this.appearance);
        ensureStyle(this.shadow, `${getAnchoredMotionCss()}\n${CSS}`, {
            id: 'aimd-formula-assistant-base',
            cache: 'shared',
        });
        this.surfaceSession = new SurfaceSession<AppearanceSnapshot, UiLocale>({
            profile: 'anchored',
            responsiveProfile: RESPONSIVE_PROFILE,
            motionProfile: getDefaultSurfaceMotionProfile('anchored'),
            appearance: {
                currentValue: this.appearance,
                equals: areAppearanceSnapshotsEqual,
                apply: (snapshot) => {
                    this.appearance = snapshot;
                    this.host.dataset.aimdTheme = snapshot.theme;
                    this.appearanceScope.apply(snapshot);
                    if (this.openState) this.render();
                },
            },
            locale: {
                currentValue: getLocale(),
                apply: () => {
                    if (this.openState) this.render();
                },
            },
        });
        this.unsubscribeLocale = subscribeLocaleChange((locale) => this.surfaceSession.setLocale(locale));
    }

    setAppearance(snapshot: AppearanceSnapshot): void {
        this.surfaceSession.setAppearance(snapshot);
    }

    show(view: FormulaComposerAssistantView): void {
        const wasOpen = this.openState;
        this.surfaceSession.cancelClose();
        this.view = view;
        this.openState = true;
        this.host.hidden = false;
        this.host.style.pointerEvents = '';
        this.root.inert = false;
        this.render();
        if (wasOpen) {
            this.surfaceSession.position();
            this.surfaceSession.syncMotion({ surface: this.root });
            return;
        }
        this.surfaceSession.syncPositioner(this.createPositioner());
        this.surfaceSession.syncOutsideDismiss({
            eventTarget: document,
            roots: () => [this.host, ...(this.params.getDismissRoots?.() ?? [])],
            onDismiss: () => this.dismiss('outside'),
        });
        this.surfaceSession.syncEscapeScope({
            root: this.host,
            keydownTarget: this.getComposerEscapeTarget(),
            onEscape: () => this.dismiss('escape'),
            maintainFocus: false,
        });
        this.surfaceSession.open({ surface: this.root });
    }

    updateSelectedIndex(selectedIndex: number): void {
        if (!this.view || this.view.selectedIndex === selectedIndex) return;
        this.view = { ...this.view, selectedIndex };
        this.render();
    }

    isOpen(): boolean {
        return this.openState;
    }

    close(): void {
        if (!this.openState) return;
        this.openState = false;
        this.surfaceSession.clearOutsideDismiss();
        this.surfaceSession.clearEscapeScope();
        this.surfaceSession.clearPositioner();
        this.root.inert = true;
        this.host.style.pointerEvents = 'none';
        const finalize = () => {
            if (this.openState) return;
            this.view = null;
            this.host.hidden = true;
            this.host.style.pointerEvents = '';
            this.root.inert = false;
            this.root.replaceChildren();
        };
        if (!this.surfaceSession.close({ surface: this.root, onClosed: finalize })) finalize();
    }

    dispose(): void {
        this.unsubscribeLocale();
        this.surfaceSession.destroy();
        this.appearanceScope.dispose();
        this.host.remove();
        this.view = null;
        this.openState = false;
    }

    private render(): void {
        const view = this.view;
        if (!view) return;
        this.root.replaceChildren();
        this.root.dataset.hasPreview = view.preview ? '1' : '0';
        this.root.setAttribute('aria-label', t('chatgptFormulaPreviewTitle'));

        if (view.preview) {
            const header = document.createElement('header');
            header.className = 'formula-preview-header';
            const title = document.createElement('span');
            title.textContent = t('chatgptFormulaPreviewTitle');
            const kind = document.createElement('span');
            kind.className = 'formula-preview-kind';
            kind.textContent = view.mathKind === 'display'
                ? t('chatgptFormulaDisplayKind')
                : t('chatgptFormulaInlineKind');
            header.append(title, kind);

            const preview = document.createElement('div');
            preview.className = 'formula-preview';
            preview.dataset.role = 'formula-preview';
            if (view.preview.status === 'ready') {
                const svg = createPreviewSvg(view.preview.asset);
                if (svg) preview.appendChild(svg);
            } else {
                const status = document.createElement('span');
                status.className = 'formula-preview-status';
                status.dataset.role = 'formula-preview-status';
                status.dataset.state = view.preview.status;
                status.textContent = view.preview.status === 'loading'
                    ? t('chatgptFormulaPreviewLoading')
                    : t('chatgptFormulaPreviewError');
                preview.appendChild(status);
            }
            this.root.append(header, preview);
        }

        if (view.suggestions.length > 0) {
            const suggestions = document.createElement('div');
            suggestions.className = 'formula-suggestions';
            renderComposerSuggestionList({
                root: suggestions,
                items: view.suggestions.map((item) => ({
                    title: item.label,
                    content: item.detail,
                    trailing: item.category,
                })),
                selectedIndex: view.selectedIndex,
                role: 'formula-suggestion',
                onHover: (index) => this.params.onHover?.(index),
                onSelect: this.params.onSelect,
            });
            this.root.appendChild(suggestions);
        }
    }

    private position(view: FormulaComposerAssistantView): void {
        const visual = window.visualViewport;
        const viewportLeft = Number.isFinite(visual?.offsetLeft) ? visual!.offsetLeft : 0;
        const viewportTop = Number.isFinite(visual?.offsetTop) ? visual!.offsetTop : 0;
        const viewportWidth = Math.max(0, Number.isFinite(visual?.width)
            ? visual!.width
            : (document.documentElement.clientWidth || window.innerWidth));
        const viewportHeight = Math.max(0, Number.isFinite(visual?.height)
            ? visual!.height
            : (document.documentElement.clientHeight || window.innerHeight));
        const margin = RESPONSIVE_PROFILE.viewportGutterPx;
        const availableWidth = Math.max(0, viewportWidth - (margin * 2));
        const width = Math.min(view.mathKind === 'display' ? 520 : 440, availableWidth);
        this.host.style.width = `${width}px`;
        const availableHeight = Math.max(0, viewportHeight - (margin * 2));
        const measuredHeight = Math.min(
            availableHeight,
            Math.max(120, this.root.getBoundingClientRect().height || (view.suggestions.length > 0 ? 360 : 180)),
        );
        const gap = 8;
        const minLeft = viewportLeft + margin;
        const minTop = viewportTop + margin;
        const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - width - margin);
        const maxTop = Math.max(minTop, viewportTop + viewportHeight - measuredHeight - margin);
        const left = Math.max(minLeft, Math.min(view.anchorRect.left, maxLeft));
        const above = view.anchorRect.top - measuredHeight - gap;
        const top = above >= minTop
            ? above
            : Math.min(maxTop, view.anchorRect.bottom + gap);
        this.host.style.left = `${left}px`;
        this.host.style.top = `${Math.max(minTop, top)}px`;
    }

    private dismiss(reason: FormulaComposerAssistantDismissReason): void {
        if (!this.openState) return;
        this.close();
        this.params.onDismiss?.(reason);
    }

    private getComposerEscapeTarget(): EventTarget {
        return this.params.getDismissRoots?.().find(
            (root): root is HTMLElement => root instanceof HTMLElement,
        ) ?? this.host;
    }

    private createPositioner(): SurfacePositioner {
        const onViewportChange = () => this.surfaceSession.position();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, { capture: true });
        window.visualViewport?.addEventListener('resize', onViewportChange);
        window.visualViewport?.addEventListener('scroll', onViewportChange);
        return {
            update: () => {
                if (this.view) this.position(this.view);
            },
            destroy: () => {
                window.removeEventListener('resize', onViewportChange);
                window.removeEventListener('scroll', onViewportChange, { capture: true } as any);
                window.visualViewport?.removeEventListener('resize', onViewportChange);
                window.visualViewport?.removeEventListener('scroll', onViewportChange);
            },
        };
    }
}
