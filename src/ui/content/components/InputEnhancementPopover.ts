import type { ChatGPTInputEnhancementSettings } from '../../../core/settings/types';
import { DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS } from '../../../core/settings/types';
import { AppearanceScope } from '../../../style/appearanceScope';
import { createAppearanceSnapshot, type AppearanceSnapshot } from '../../../style/appearance';
import { ensureStyle } from '../../../style/shadow';
import { t, subscribeLocaleChange } from './i18n';
import { SurfaceSession, getDefaultSurfaceMotionProfile } from './SurfaceRuntime';
import { getAnchoredMotionCss } from './styles/anchoredMotionCss';
import { markTransientRoot } from './transientUi';
import { showToast } from '../../../utils/toast';

const clone = (value: ChatGPTInputEnhancementSettings) => ({ ...value, lists: { ...value.lists } });
const CSS = `
:host { position: fixed; right: var(--aimd-space-3); bottom: calc(var(--aimd-size-control-icon-panel) + var(--aimd-space-5)); z-index: var(--aimd-z-tooltip); font-family: var(--aimd-font-family-sans); color: var(--aimd-text-primary); }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
.input-enhancement { width: min(340px, calc(100vw - var(--aimd-space-3) * 2)); max-height: calc(100dvh - var(--aimd-size-control-icon-panel) - var(--aimd-space-6) * 2); overflow: auto; padding: var(--aimd-space-4); border: 1px solid var(--aimd-workspace-border); border-radius: var(--aimd-radius-2xl); background: var(--aimd-workspace-card); box-shadow: var(--aimd-workspace-raised); }
header, label { display: flex; align-items: center; justify-content: space-between; gap: var(--aimd-space-3); }
header { margin-bottom: var(--aimd-space-2); font-weight: var(--aimd-font-semibold); }
header button { font: inherit; color: var(--aimd-text-secondary); background: var(--aimd-button-icon-bg); border: none; border-radius: var(--aimd-radius-full); width: var(--aimd-size-control-icon-panel); height: var(--aimd-size-control-icon-panel); cursor: pointer; }
h3 { font-size: var(--aimd-text-xs); color: var(--aimd-text-secondary); margin: var(--aimd-space-3) 0 var(--aimd-space-1); }
label { font-size: var(--aimd-text-sm); padding-block: var(--aimd-space-2); cursor: pointer; }
input { accent-color: var(--aimd-interactive-primary); width: var(--aimd-space-4); height: var(--aimd-space-4); flex: none; }
:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
label:has(input:disabled) { opacity: .5; cursor: default; }
`;

export class InputEnhancementPopover {
    readonly host = markTransientRoot(document.createElement('div'));
    private readonly shadow = this.host.attachShadow({ mode: 'open' });
    private readonly panel = document.createElement('section');
    private readonly scope = AppearanceScope.forShadowRoot(this.shadow, { styleId: 'aimd-input-enhancement-tokens' });
    private readonly session = new SurfaceSession({ profile: 'anchored', motionProfile: getDefaultSurfaceMotionProfile('anchored') });
    private readonly unsubscribeLocale = subscribeLocaleChange(() => this.render());
    private settings = clone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS);
    private pending = false;
    private focusedRole: string | undefined;

    constructor(private readonly onChange: (settings: ChatGPTInputEnhancementSettings) => Promise<boolean>) {
        this.host.dataset.aimdRole = 'input-enhancement-popover';
        this.host.hidden = true;
        this.panel.className = 'input-enhancement';
        this.panel.dataset.aimdSurfaceProfile = 'anchored';
        this.panel.setAttribute('role', 'dialog');
        this.shadow.append(this.panel);
        this.panel.addEventListener('focusin', event => {
            this.focusedRole = event.target instanceof HTMLInputElement ? event.target.dataset.role : undefined;
        });
        ensureStyle(this.shadow, getAnchoredMotionCss() + CSS, { id: 'aimd-input-enhancement-style' });
        this.setAppearance(createAppearanceSnapshot('light'));
    }

    setAppearance(snapshot: AppearanceSnapshot): void { this.scope.apply(snapshot); }
    updateSettings(settings: ChatGPTInputEnhancementSettings): void { this.settings = clone(settings); this.render(); }
    toggle(anchor: HTMLElement): void {
        if (!this.host.hidden) { this.close(); return; }
        if (!this.host.isConnected) document.body.append(this.host);
        this.session.cancelClose();
        this.host.hidden = false;
        this.render();
        this.session.captureFocus(anchor);
        this.session.syncOutsideDismiss({ eventTarget: document, roots: [this.host, anchor], onDismiss: () => this.close(false) });
        this.session.syncEscapeScope({ root: this.host, keydownTarget: this.shadow, trapTabWithin: this.panel, onEscape: () => this.close() });
        this.session.open({ surface: this.panel });
        this.session.scheduleInitialFocus({ surface: this.panel, selectors: ['input'] });
    }
    close(restoreFocus = true): void {
        this.session.clearOutsideDismiss(); this.session.clearEscapeScope();
        this.host.hidden = true;
        if (restoreFocus) this.session.restoreFocus();
    }
    dispose(): void { this.unsubscribeLocale(); this.session.destroy(); this.scope.dispose(); this.host.remove(); }

    private render(): void {
        this.panel.replaceChildren();
        this.panel.setAttribute('aria-label', t('settingsInputEnhancementControl'));
        const header = document.createElement('header');
        const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', t('btnClose'));
        close.addEventListener('click', () => this.close());
        header.append(document.createTextNode(t('settingsInputEnhancementControl')), close); this.panel.append(header);
        const heading = (key: string) => { const el = document.createElement('h3'); el.textContent = t(key); this.panel.append(el); };
        const toggle = (key: string, checked: boolean, change: (next: ChatGPTInputEnhancementSettings, value: boolean) => void, disabled = false) => {
            const row = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
            input.dataset.role = key; input.disabled = this.pending || disabled;
            input.addEventListener('change', () => void this.save(next => change(next, input.checked)));
            row.append(document.createTextNode(t(key)), input); this.panel.append(row);
        };
        const enabled = this.settings.available && this.settings.enabled;
        toggle('chatgptInputEnhancementMasterLabel', enabled, (next, value) => { next.available = true; next.enabled = value; });
        heading('settingsGroupEditing');
        toggle('chatgptInputEnhancementEnterLabel', this.settings.enterKeyNewline, (next, value) => { next.enterKeyNewline = value; }, !enabled);
        toggle('chatgptInputEnhancementBoldLabel', this.settings.boldShortcut, (next, value) => { next.boldShortcut = value; }, !enabled);
        heading('chatgptInputEnhancementListsLabel');
        for (const [key, label] of [['enabled', 'chatgptInputEnhancementListsLabel'], ['ordered', 'chatgptInputEnhancementOrderedListLabel'], ['unordered', 'chatgptInputEnhancementUnorderedListLabel']] as const) {
            toggle(label, this.settings.lists[key], (next, value) => { next.lists[key] = value; }, !enabled || (key !== 'enabled' && !this.settings.lists.enabled));
        }
        heading('settingsGroupFormulaAssistant');
        toggle('chatgptInputEnhancementFormulaSuggestionsLabel', this.settings.formulaSuggestions, (next, value) => { next.formulaSuggestions = value; }, !enabled);
        toggle('chatgptInputEnhancementFormulaPreviewLabel', this.settings.formulaPreview, (next, value) => { next.formulaPreview = value; }, !enabled);
        if (!this.host.hidden && !this.pending && this.focusedRole) {
            this.panel.querySelector<HTMLInputElement>(`[data-role="${this.focusedRole}"]`)?.focus({ preventScroll: true });
        }
    }
    private async save(change: (next: ChatGPTInputEnhancementSettings) => void): Promise<void> {
        if (this.pending) return;
        const previous = clone(this.settings); const next = clone(previous); change(next);
        this.settings = next; this.pending = true; this.render();
        try { if (!await this.onChange(clone(next))) throw new Error('save'); }
        catch { this.settings = previous; showToast({ text: t('settingsSaveFailed'), tone: 'error' }); }
        finally { this.pending = false; this.render(); }
    }
}
