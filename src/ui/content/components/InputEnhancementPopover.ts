import type { ChatGPTInputEnhancementSettings } from '../../../core/settings/types';
import type { Theme } from '../../../core/types/theme';
import { checkIcon, chevronRightIcon, fileCodeIcon, xIcon } from '../../../assets/icons';
import { ensureStyle } from '../../../style/shadow';
import { getTokenCss, type UserThemeOverrides } from '../../../style/tokens';
import { subscribeLocaleChange, t } from './i18n';
import { createIcon } from './Icon';
import { markTransientRoot } from './transientUi';

export type InputEnhancementPopoverCloseReason = 'escape' | 'outside' | 'programmatic';

const CSS = `
:host {
  box-sizing: border-box;
  position: fixed;
  inset: 0 auto auto 0;
  z-index: var(--aimd-z-tooltip);
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
* { box-sizing: border-box; }
.input-enhancement-popover {
  width: min(328px, calc(100vw - var(--aimd-space-4) * 2));
  max-height: calc(100vh - var(--aimd-space-4) * 2);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-panel);
  animation: input-enhancement-enter var(--aimd-duration-base) var(--aimd-ease-out);
}
.input-enhancement-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-3) var(--aimd-space-3) var(--aimd-space-2) var(--aimd-space-4);
}
.input-enhancement-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
}
.input-enhancement-title-icon {
  display: inline-grid;
  place-items: center;
  width: var(--aimd-size-control-compact-relaxed);
  height: var(--aimd-size-control-compact-relaxed);
  flex: 0 0 auto;
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-highlight);
}
.input-enhancement-title-icon .aimd-icon,
.input-enhancement-title-icon svg {
  display: block;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.input-enhancement-title {
  margin: 0;
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  line-height: var(--aimd-leading-normal);
}
.input-enhancement-close {
  all: unset;
  box-sizing: border-box;
  display: inline-grid;
  place-items: center;
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  cursor: pointer;
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-close:hover {
  color: var(--aimd-button-icon-text-hover);
  background: var(--aimd-button-icon-hover);
}
.input-enhancement-close:active { transform: scale(0.94); }
.input-enhancement-close svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
.input-enhancement-close:focus-visible,
.input-enhancement-guide:focus-visible,
.input-enhancement-toggle input:focus-visible + .input-enhancement-track,
.input-enhancement-choice input:focus-visible + .input-enhancement-choice-surface {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}
.input-enhancement-body {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-2) var(--aimd-space-2);
  overflow: auto;
  overscroll-behavior: contain;
}
.input-enhancement-section {
  min-width: 0;
  display: grid;
  gap: var(--aimd-space-1);
  padding-top: var(--aimd-space-2);
  border-top: 1px solid var(--aimd-border-subtle);
}
.input-enhancement-section-title {
  margin: 0;
  padding: 0 var(--aimd-space-2) var(--aimd-space-1);
  color: var(--aimd-text-tertiary);
  font-size: var(--aimd-font-size-xs);
  font-weight: var(--aimd-font-semibold);
  line-height: var(--aimd-leading-normal);
}
.input-enhancement-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-2);
  border-radius: var(--aimd-radius-md);
  cursor: pointer;
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-row:hover:not([data-disabled="1"]):not([data-variant="master"]) {
  background: var(--aimd-surface-hover);
}
.input-enhancement-row[data-variant="master"] {
  margin: 0;
  padding: var(--aimd-space-3);
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
}
.input-enhancement-row[data-variant="master"][data-checked="1"] {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 34%, var(--aimd-border-subtle));
  background: var(--aimd-interactive-highlight);
}
.input-enhancement-copy { min-width: 0; }
.input-enhancement-label {
  display: block;
  color: var(--aimd-text-primary);
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-medium);
  line-height: var(--aimd-leading-normal);
}
.input-enhancement-description {
  display: block;
  margin-top: var(--aimd-space-1);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
}
.input-enhancement-row[data-disabled="1"] {
  cursor: not-allowed;
}
.input-enhancement-row[data-disabled="1"] .input-enhancement-copy { opacity: 0.48; }
.input-enhancement-toggle {
  position: relative;
  display: inline-flex;
  width: var(--aimd-size-control-action-panel);
  height: calc(var(--aimd-size-control-glyph-panel) + var(--aimd-space-1));
  flex: 0 0 auto;
}
.input-enhancement-toggle input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.input-enhancement-toggle input:disabled { cursor: not-allowed; }
.input-enhancement-track {
  width: 100%;
  height: 100%;
  pointer-events: none;
  padding: calc(var(--aimd-space-1) / 2);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
  transition: background var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out), box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-track::after {
  content: "";
  display: block;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-color-white);
  box-shadow: var(--aimd-shadow-sm);
  transform: translateX(0);
  transition: transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-toggle input:checked + .input-enhancement-track {
  border-color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-primary);
}
.input-enhancement-toggle input:checked + .input-enhancement-track::after {
  transform: translateX(calc(var(--aimd-size-control-action-panel) - var(--aimd-size-control-glyph-panel) - var(--aimd-space-1)));
}
.input-enhancement-toggle input:not(:disabled):hover + .input-enhancement-track { border-color: var(--aimd-border-strong); }
.input-enhancement-toggle input:disabled + .input-enhancement-track { opacity: 0.48; }
.input-enhancement-list-types {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--aimd-space-1);
  padding: 0 var(--aimd-space-2) var(--aimd-space-1);
}
.input-enhancement-choice {
  position: relative;
  min-width: 0;
  cursor: pointer;
}
.input-enhancement-choice[data-disabled="1"] { cursor: not-allowed; }
.input-enhancement-choice input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}
.input-enhancement-choice-surface {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--aimd-space-2);
  pointer-events: none;
  padding: var(--aimd-space-2);
  border: 1px solid var(--aimd-border-subtle);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-secondary);
  background: var(--aimd-bg-secondary);
  font-size: var(--aimd-font-size-xs);
  font-weight: var(--aimd-font-medium);
  line-height: var(--aimd-leading-normal);
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), border-color var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-choice input:not(:disabled):hover + .input-enhancement-choice-surface {
  color: var(--aimd-text-primary);
  border-color: var(--aimd-border-default);
  background: var(--aimd-surface-hover);
}
.input-enhancement-choice input:checked + .input-enhancement-choice-surface {
  color: var(--aimd-text-primary);
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 30%, var(--aimd-border-subtle));
  background: var(--aimd-interactive-highlight);
}
.input-enhancement-choice input:not(:disabled):active + .input-enhancement-choice-surface { transform: scale(0.98); }
.input-enhancement-choice input:disabled + .input-enhancement-choice-surface { opacity: 0.48; }
.input-enhancement-choice-indicator {
  display: inline-grid;
  place-items: center;
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  flex: 0 0 auto;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-sm);
  color: var(--aimd-text-on-primary);
  background: var(--aimd-bg-primary);
}
.input-enhancement-choice-indicator svg {
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-choice input:checked + .input-enhancement-choice-surface .input-enhancement-choice-indicator {
  border-color: var(--aimd-interactive-primary);
  background: var(--aimd-interactive-primary);
}
.input-enhancement-choice input:checked + .input-enhancement-choice-surface .input-enhancement-choice-indicator svg { opacity: 1; }
.input-enhancement-footer {
  padding: var(--aimd-space-2);
  border-top: 1px solid var(--aimd-border-subtle);
}
.input-enhancement-guide {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-medium);
  cursor: pointer;
  transition: color var(--aimd-duration-fast) var(--aimd-ease-in-out), background var(--aimd-duration-fast) var(--aimd-ease-in-out), transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
}
.input-enhancement-guide:hover {
  color: var(--aimd-text-primary);
  background: var(--aimd-button-icon-hover);
}
.input-enhancement-guide:active { transform: scale(0.99); }
.input-enhancement-guide svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
}
@keyframes input-enhancement-enter {
  from { opacity: 0; transform: translateY(var(--aimd-space-2)) scale(0.98); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .input-enhancement-popover,
  .input-enhancement-close,
  .input-enhancement-row,
  .input-enhancement-track,
  .input-enhancement-track::after,
  .input-enhancement-choice-surface,
  .input-enhancement-choice-indicator svg,
  .input-enhancement-guide { animation: none; transition: none; }
}
`;

export class InputEnhancementPopover {
    readonly host: HTMLElement;
    private readonly shadow: ShadowRoot;
    private readonly root: HTMLElement;
    private readonly unsubscribeLocale: () => void;
    private settings: ChatGPTInputEnhancementSettings | null = null;
    private anchor: HTMLElement | null = null;
    private pending = false;
    private theme: Theme = 'light';
    private themeOverrides: UserThemeOverrides = {};

    constructor(private readonly params: {
        onChange: (settings: ChatGPTInputEnhancementSettings) => void;
        onClose: (reason: InputEnhancementPopoverCloseReason) => void;
        onOpenGuide: () => void;
    }) {
        this.host = markTransientRoot(document.createElement('div'));
        this.host.dataset.aimdRole = 'input-enhancement-popover';
        this.host.hidden = true;
        this.shadow = this.host.attachShadow({ mode: 'open' });
        this.root = document.createElement('section');
        this.root.id = 'aimd-input-enhancement-popover';
        this.root.className = 'input-enhancement-popover';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-modal', 'false');
        this.shadow.appendChild(this.root);
        document.body.appendChild(this.host);
        this.unsubscribeLocale = subscribeLocaleChange(() => this.render());
    }

    open(params: { anchor: HTMLElement; settings: ChatGPTInputEnhancementSettings; pending?: boolean }): void {
        this.anchor = params.anchor;
        this.settings = this.cloneSettings(params.settings);
        this.pending = Boolean(params.pending);
        this.host.hidden = false;
        this.render();
        this.position();
        document.addEventListener('pointerdown', this.onDocumentPointerDown, { capture: true });
        document.addEventListener('keydown', this.onDocumentKeyDown, { capture: true });
        window.addEventListener('resize', this.onViewportChange);
        window.addEventListener('scroll', this.onViewportChange, { capture: true });
        window.setTimeout(() => {
            this.shadow.querySelector<HTMLInputElement>('[data-role="input-enhancement-enabled"]')?.focus();
        }, 0);
    }

    update(settings: ChatGPTInputEnhancementSettings, pending = this.pending): void {
        this.settings = this.cloneSettings(settings);
        this.pending = pending;
        if (!this.host.hidden) this.render();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        if (!this.host.hidden) this.render();
    }

    setThemeOverrides(overrides: UserThemeOverrides): void {
        this.themeOverrides = { ...overrides };
        if (!this.host.hidden) this.render();
    }

    isOpen(): boolean {
        return !this.host.hidden;
    }

    close(reason: InputEnhancementPopoverCloseReason = 'programmatic'): void {
        if (this.host.hidden) return;
        this.host.hidden = true;
        this.detachListeners();
        this.params.onClose(reason);
    }

    dispose(): void {
        this.detachListeners();
        this.unsubscribeLocale();
        this.host.remove();
        this.settings = null;
        this.anchor = null;
    }

    private render(): void {
        const settings = this.settings;
        if (!settings) return;
        ensureStyle(this.shadow, getTokenCss(this.theme, this.themeOverrides), { id: 'aimd-input-enhancement-tokens' });
        ensureStyle(this.shadow, CSS, { id: 'aimd-input-enhancement-popover-style', cache: 'shared' });
        this.root.replaceChildren();
        this.root.removeAttribute('aria-label');
        this.root.setAttribute('aria-labelledby', 'aimd-input-enhancement-title');

        const header = document.createElement('header');
        header.className = 'input-enhancement-header';
        const heading = document.createElement('div');
        heading.className = 'input-enhancement-heading';
        const titleIcon = document.createElement('span');
        titleIcon.className = 'input-enhancement-title-icon';
        titleIcon.setAttribute('aria-hidden', 'true');
        titleIcon.appendChild(createIcon(fileCodeIcon));
        const title = document.createElement('h2');
        title.id = 'aimd-input-enhancement-title';
        title.className = 'input-enhancement-title';
        title.textContent = t('chatgptInputEnhancementTitle');
        heading.append(titleIcon, title);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'input-enhancement-close';
        close.dataset.role = 'input-enhancement-close';
        close.setAttribute('aria-label', t('btnClose'));
        close.innerHTML = xIcon;
        close.addEventListener('click', () => this.close('programmatic'));
        header.append(heading, close);

        const body = document.createElement('div');
        body.className = 'input-enhancement-body';
        body.setAttribute('aria-busy', this.pending ? 'true' : 'false');
        const master = this.createToggleRow({
            role: 'input-enhancement-enabled',
            label: t('chatgptInputEnhancementMasterLabel'),
            description: t('chatgptInputEnhancementMasterDesc'),
            checked: settings.enabled,
            disabled: this.pending,
            variant: 'master',
            onChange: (checked) => this.apply({ enabled: checked }),
        });
        master.dataset.role = 'input-enhancement-master';

        const listTypes = document.createElement('div');
        listTypes.className = 'input-enhancement-list-types';
        listTypes.dataset.role = 'input-enhancement-list-types';
        listTypes.setAttribute('role', 'group');
        listTypes.setAttribute('aria-label', t('chatgptInputEnhancementListsLabel'));
        listTypes.append(
            this.createChoice({
                role: 'input-enhancement-list-ordered',
                label: t('chatgptInputEnhancementOrderedListLabel'),
                checked: settings.lists.ordered,
                disabled: this.pending || !settings.enabled || !settings.lists.enabled,
                onChange: (checked) => this.apply({ lists: { ...settings.lists, ordered: checked } }),
            }),
            this.createChoice({
                role: 'input-enhancement-list-unordered',
                label: t('chatgptInputEnhancementUnorderedListLabel'),
                checked: settings.lists.unordered,
                disabled: this.pending || !settings.enabled || !settings.lists.enabled,
                onChange: (checked) => this.apply({ lists: { ...settings.lists, unordered: checked } }),
            }),
        );

        const authoringSection = this.createSection({
            role: 'input-enhancement-authoring-section',
            label: t('chatgptInputEnhancementAuthoringSection'),
            children: [
            this.createToggleRow({
                role: 'input-enhancement-enter-newline',
                label: t('chatgptInputEnhancementEnterLabel'),
                checked: settings.enterKeyNewline,
                disabled: this.pending || !settings.enabled,
                onChange: (checked) => this.apply({ enterKeyNewline: checked }),
            }),
            this.createToggleRow({
                role: 'input-enhancement-lists',
                label: t('chatgptInputEnhancementListsLabel'),
                checked: settings.lists.enabled,
                disabled: this.pending || !settings.enabled,
                onChange: (checked) => this.apply({ lists: { ...settings.lists, enabled: checked } }),
            }),
            listTypes,
            this.createToggleRow({
                role: 'input-enhancement-bold',
                label: t('chatgptInputEnhancementBoldLabel'),
                checked: settings.boldShortcut,
                disabled: this.pending || !settings.enabled,
                onChange: (checked) => this.apply({ boldShortcut: checked }),
            }),
            ],
        });

        const formulaSection = this.createSection({
            role: 'input-enhancement-formula-section',
            label: t('chatgptInputEnhancementFormulaSection'),
            children: [
            this.createToggleRow({
                role: 'input-enhancement-formula-suggestions',
                label: t('chatgptInputEnhancementFormulaSuggestionsLabel'),
                checked: settings.formulaSuggestions,
                disabled: this.pending || !settings.enabled,
                onChange: (checked) => this.apply({ formulaSuggestions: checked }),
            }),
            this.createToggleRow({
                role: 'input-enhancement-formula-preview',
                label: t('chatgptInputEnhancementFormulaPreviewLabel'),
                checked: settings.formulaPreview,
                disabled: this.pending || !settings.enabled,
                onChange: (checked) => this.apply({ formulaPreview: checked }),
            }),
            ],
        });
        body.append(master, authoringSection, formulaSection);

        const footer = document.createElement('footer');
        footer.className = 'input-enhancement-footer';
        const guide = document.createElement('button');
        guide.type = 'button';
        guide.className = 'input-enhancement-guide';
        guide.dataset.role = 'input-enhancement-guide';
        guide.innerHTML = `<span>${t('chatgptInputEnhancementGuideLabel')}</span><span aria-hidden="true">${chevronRightIcon}</span>`;
        guide.addEventListener('click', () => this.params.onOpenGuide());
        footer.appendChild(guide);
        this.root.append(header, body, footer);
    }

    private createSection(params: { role: string; label: string; children: HTMLElement[] }): HTMLElement {
        const section = document.createElement('section');
        const titleId = `aimd-${params.role}-title`;
        section.className = 'input-enhancement-section';
        section.dataset.role = params.role;
        section.setAttribute('aria-labelledby', titleId);
        const title = document.createElement('h3');
        title.id = titleId;
        title.className = 'input-enhancement-section-title';
        title.textContent = params.label;
        section.append(title, ...params.children);
        return section;
    }

    private createToggleRow(params: {
        role: string;
        label: string;
        description?: string;
        checked: boolean;
        disabled: boolean;
        variant?: 'master';
        onChange: (checked: boolean) => void;
    }): HTMLElement {
        const row = document.createElement('label');
        row.className = 'input-enhancement-row';
        row.dataset.disabled = params.disabled ? '1' : '0';
        row.dataset.checked = params.checked ? '1' : '0';
        if (params.variant) row.dataset.variant = params.variant;
        const copy = document.createElement('div');
        copy.className = 'input-enhancement-copy';
        const labelText = document.createElement('span');
        labelText.className = 'input-enhancement-label';
        labelText.textContent = params.label;
        copy.appendChild(labelText);
        if (params.description) {
            const description = document.createElement('span');
            description.className = 'input-enhancement-description';
            description.textContent = params.description;
            copy.appendChild(description);
        }
        const toggle = document.createElement('span');
        toggle.className = 'input-enhancement-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.role = params.role;
        input.checked = params.checked;
        input.disabled = params.disabled;
        input.setAttribute('aria-label', params.label);
        input.addEventListener('change', () => params.onChange(input.checked));
        const track = document.createElement('span');
        track.className = 'input-enhancement-track';
        track.setAttribute('aria-hidden', 'true');
        toggle.append(input, track);
        row.append(copy, toggle);
        return row;
    }

    private createChoice(params: {
        role: string;
        label: string;
        checked: boolean;
        disabled: boolean;
        onChange: (checked: boolean) => void;
    }): HTMLElement {
        const choice = document.createElement('label');
        choice.className = 'input-enhancement-choice';
        choice.dataset.disabled = params.disabled ? '1' : '0';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.role = params.role;
        input.checked = params.checked;
        input.disabled = params.disabled;
        input.setAttribute('aria-label', params.label);
        input.addEventListener('change', () => params.onChange(input.checked));
        const surface = document.createElement('span');
        surface.className = 'input-enhancement-choice-surface';
        const indicator = document.createElement('span');
        indicator.className = 'input-enhancement-choice-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.innerHTML = checkIcon;
        const label = document.createElement('span');
        label.textContent = params.label;
        surface.append(indicator, label);
        choice.append(input, surface);
        return choice;
    }

    private apply(patch: Partial<ChatGPTInputEnhancementSettings>): void {
        if (!this.settings || this.pending) return;
        this.settings = this.cloneSettings({ ...this.settings, ...patch });
        const next = this.cloneSettings(this.settings);
        this.render();
        this.params.onChange(next);
    }

    private cloneSettings(settings: ChatGPTInputEnhancementSettings): ChatGPTInputEnhancementSettings {
        return { ...settings, lists: { ...settings.lists } };
    }

    private position(): void {
        if (!this.anchor || this.host.hidden) return;
        const rect = this.anchor.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        const surface = this.root.getBoundingClientRect();
        const width = surface.width || Math.min(328, viewportWidth - 32);
        const height = surface.height || Math.min(520, viewportHeight - 32);
        const margin = 16;
        const gap = 8;
        const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
        const above = rect.top - height - gap;
        const top = above >= margin
            ? above
            : Math.min(viewportHeight - height - margin, rect.bottom + gap);
        this.host.style.left = `${left}px`;
        this.host.style.top = `${Math.max(margin, top)}px`;
    }

    private onDocumentPointerDown = (event: Event): void => {
        const path = event.composedPath?.() ?? [];
        if (path.includes(this.host) || (this.anchor && path.includes(this.anchor))) return;
        this.close('outside');
    };

    private onDocumentKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        event.stopPropagation();
        this.close('escape');
    };

    private onViewportChange = (): void => this.position();

    private detachListeners(): void {
        document.removeEventListener('pointerdown', this.onDocumentPointerDown, { capture: true } as any);
        document.removeEventListener('keydown', this.onDocumentKeyDown, { capture: true } as any);
        window.removeEventListener('resize', this.onViewportChange);
        window.removeEventListener('scroll', this.onViewportChange, { capture: true } as any);
    }
}
