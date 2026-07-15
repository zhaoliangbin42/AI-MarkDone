import type { LatexSnippetItem } from '../../../core/math/latexSnippets';
import type { FormulaSvgAsset } from '../../../core/math/formulaAssetTypes';
import type { MarkdownMathKind } from '../../../core/sending/markdownMath';
import { ensureStyle } from '../../../style/shadow';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import { subscribeLocaleChange, t } from './i18n';
import { markTransientRoot } from './transientUi';
import {
    COMPOSER_SUGGESTION_LIST_CSS,
    renderComposerSuggestionList,
} from './ComposerSuggestionList';

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
  animation: formula-assistant-enter var(--aimd-duration-fast) var(--aimd-ease-out);
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
@keyframes formula-assistant-enter {
  from { opacity: 0; transform: translateY(var(--aimd-space-1)); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .formula-assistant { animation: none; }
}
`;

function resolveTheme(): 'light' | 'dark' {
    const attr = document.documentElement.getAttribute('data-aimd-theme')
        || document.documentElement.getAttribute('data-theme');
    return attr === 'dark' || document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

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
    private readonly unsubscribeLocale: () => void;
    private themeOverrides: UserThemeOverrides = {};
    private view: FormulaComposerAssistantView | null = null;

    constructor(private readonly params: { onSelect: (index: number) => void; onHover?: (index: number) => void }) {
        this.host = markTransientRoot(document.createElement('div'));
        this.host.dataset.aimdRole = 'formula-composer-assistant';
        this.host.style.position = 'fixed';
        this.host.style.left = '0px';
        this.host.style.top = '0px';
        this.host.style.zIndex = 'var(--aimd-z-tooltip)';
        this.host.hidden = true;
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.root = document.createElement('section');
        this.root.className = 'formula-assistant';
        this.root.setAttribute('role', 'region');
        this.shadow.appendChild(this.root);
        document.body.appendChild(this.host);
        this.unsubscribeLocale = subscribeLocaleChange(() => this.render());
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        if (this.view) this.render();
    }

    refreshTheme(): void {
        if (this.view) this.render();
    }

    show(view: FormulaComposerAssistantView): void {
        this.view = view;
        this.host.hidden = false;
        this.render();
        this.position(view);
    }

    updateSelectedIndex(selectedIndex: number): void {
        if (!this.view || this.view.selectedIndex === selectedIndex) return;
        this.view = { ...this.view, selectedIndex };
        this.render();
    }

    close(): void {
        this.view = null;
        this.host.hidden = true;
        this.root.replaceChildren();
    }

    dispose(): void {
        this.unsubscribeLocale();
        this.host.remove();
        this.view = null;
    }

    private render(): void {
        const view = this.view;
        if (!view) return;
        const theme = resolveTheme();
        this.host.setAttribute('data-aimd-theme', theme);
        ensureStyle(this.shadow, getTokenCss(theme, this.themeOverrides), { id: 'aimd-formula-assistant-tokens' });
        ensureStyle(this.shadow, CSS, { id: 'aimd-formula-assistant-base', cache: 'shared' });
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
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        const width = Math.min(view.mathKind === 'display' ? 520 : 440, Math.max(280, viewportWidth - 32));
        this.host.style.width = `${width}px`;
        const measuredHeight = Math.max(120, this.root.getBoundingClientRect().height || (view.suggestions.length > 0 ? 360 : 180));
        const gap = 8;
        const margin = 16;
        const left = Math.max(margin, Math.min(view.anchorRect.left, viewportWidth - width - margin));
        const above = view.anchorRect.top - measuredHeight - gap;
        const top = above >= margin
            ? above
            : Math.min(viewportHeight - measuredHeight - margin, view.anchorRect.bottom + gap);
        this.host.style.left = `${left}px`;
        this.host.style.top = `${Math.max(margin, top)}px`;
    }
}
