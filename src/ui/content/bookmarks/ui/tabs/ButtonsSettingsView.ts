import { loadLatexSnippetCatalog } from '../../../../../services/math/latexSnippetCatalog';
import { getFormulaAssistantViewCss, getFormulaAssistantMaxWidth, renderFormulaAssistantView, type FormulaComposerAssistantView } from '../../../components/FormulaComposerAssistantPopover';
import { FormulaPreviewPipeline } from '../../../../../services/math/formulaPreviewPipeline';
import type { FormulaRenderOptions, FormulaSvgAsset } from '../../../../../services/math/formulaAssetRenderer';
import { searchLatexSnippets } from '../../../../../core/math/latexSnippets';
import { createPageSelectionToolbar, getPageSelectionToolbarCss } from '../../../pageAnnotations/PageAnnotationOverlay';
import { getAnnotationActionButtonCss } from '../../../pageAnnotations/annotationActionButtonCss';
import { targetSurfacePolicy } from '../../../../../config/targetSurface';
import { DEFAULT_SETTINGS, PAGE_CONTROL_ACTIONS, MESSAGE_CONTROL_ACTIONS, type AppSettings, type SettingsCategory, type PageControlAction } from '../../../../../core/settings/types';
import { readPreferencePath, mergePortableSettings } from '../../../../../core/settings/portableSettings';
import { MessageToolbar, type MessageToolbarAction } from '../../../MessageToolbar';
import { ToolbarHoverActionPortal } from '../../../components/ToolbarHoverActionPortal';
import { createFormulaAssetActionItems, getFormulaAssetActionRowCss } from '../../../components/formulaAssetActionItems';
import { getChatGPTPageControlsCss } from '../../../components/pageControlsCss';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';
import { createBrandIcon, sigmaIcon, pinIcon } from '../../../../../assets/icons';
import { pageBookmarkIcon, outlineIcon } from '../../../../../assets/workspaceIcons';
import { resolveChatGPTInputEnhancement } from '../../../../../core/settings/inputEnhancement';
import { bookmarkIcon, copyIcon, promptReplyIcon, imageIcon, bookOpenIcon, downloadIcon, splitViewIcon, messageSquareTextIcon, textCursorIcon, refreshCwIcon, promptIcon, settingsIcon, moreHorizontalIcon, highlighterIcon, chevronDownIcon } from '../../../../../assets/workspaceIcons';
import { AppearanceScope } from '../../../../../style/appearanceScope';
import { createAppearanceSnapshot, areAppearanceSnapshotsEqual, type AppearanceSnapshot } from '../../../../../style/appearance';
import { ensureStyle } from '../../../../../style/shadow';
type Row = {
    path: string;
    label: string;
    icon: string;
    pin?: string;
    pinsPath?: string;
    parent?: string;
};
const PIN = pinIcon;
const CURSOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 2v17l5-5 4 7 3-2-4-7h7Z"/></svg>';
const pageLabels = ['chatgptPageControlBookmark', 'chatgptPageControlSplitView', 'chatgptPageControlPrompts', 'settingsInputEnhancementControl', 'chatgptRefreshMessageNavigation'];
const pageIcons = [bookmarkIcon, splitViewIcon, promptIcon, textCursorIcon, refreshCwIcon];
const pageFields = ['showPageBookmarkControl', 'showDetachedReaderControl', 'showPromptControl', 'showInputEnhancementControl', 'showRefreshNavigationControl'];
const messageLabels = ['btnBookmark', 'btnCopy', 'btnCopyPromptReply', 'btnReader', 'btnExport'];
const messageIcons = [bookmarkIcon, copyIcon, promptReplyIcon, bookOpenIcon, downloadIcon];
const GROUPS = ['Page', 'Message', 'Formula', 'Selection', 'Directory'] as const;
type Group = typeof GROUPS[number];
const GROUP_LABELS: Record<Group, string> = { Page: 'settingsButtonsGroupPage', Message: 'settingsButtonsGroupMessage', Formula: 'settingsButtonsGroupFormula', Selection: 'settingsButtonsGroupSelection', Directory: 'settingsButtonsGroupDirectory' };
const GROUP_ICONS: Record<Group, string> = { Page: pageBookmarkIcon, Message: messageSquareTextIcon, Formula: sigmaIcon, Selection: highlighterIcon, Directory: outlineIcon };
export class ButtonsSettingsView {
    readonly root = document.createElement('div');
    private readonly shadow = this.root.attachShadow({ mode: 'open' });
    private readonly scope = AppearanceScope.forShadowRoot(this.shadow);
    private settings: AppSettings = structuredClone(DEFAULT_SETTINGS);
    private appearance = createAppearanceSnapshot('light');
    private sampleKind:'inline'|'display'|'completion'='inline';
    private sampleRevision=0;
    private readonly samplePipeline:FormulaPreviewPipeline;
    private active: Group = 'Page';
    private formulaContext: 'assetActions' | 'composerAssetActions' = 'assetActions';
    private readOnly = false;
    setCompatibilityNotice(missing:boolean):void {if(missing){this.notice.dataset.kind='compatibility';this.notice.textContent=t('settingsReloadForUpdate');}else if(this.notice.dataset.kind==='compatibility'){this.notice.textContent='';delete this.notice.dataset.kind;}}

    private disposed = false;
    private query = '';
    private pending = false;
    private readonly navigation = document.createElement('nav');
    private readonly content = document.createElement('div');
    private readonly notice = document.createElement('p');
    private previews: Array<{
        dispose: () => void;
    }> = [];
    constructor(private readonly save: (category: SettingsCategory, patch: unknown) => Promise<boolean>, renderFormula?:(options:FormulaRenderOptions)=>Promise<FormulaSvgAsset>) {
        this.samplePipeline=new FormulaPreviewPipeline(renderFormula??(async options=>(await import('../../../../../services/math/formulaAssetRenderer')).renderFormulaSvgAsset(options)));
        this.root.dataset.role = 'settings-buttons';
        this.root.dataset.aimdRole = 'settings-buttons';
        ensureStyle(this.shadow, getPageSelectionToolbarCss() + getAnnotationActionButtonCss() + getFormulaAssetActionRowCss() + getFormulaAssistantViewCss() + CSS, { id: 'aimd-buttons-settings' });
        this.scope.apply(this.appearance);
        const layout = document.createElement('div');
        layout.className = 'layout';
        this.content.className = 'group-content';
        this.navigation.setAttribute('aria-label', t('settingsCategoryControls'));
        this.notice.className = 'notice';
        this.notice.setAttribute('role', 'status');
        layout.append(this.navigation, this.content);
        this.shadow.append(layout, this.notice);
        this.render();
    }
    setState(settings: AppSettings): void {
        if (this.disposed)
            return;
        this.settings = structuredClone(settings);
        this.render();
    }
    setAppearance(appearance: AppearanceSnapshot): void {
        if (this.disposed || areAppearanceSnapshotsEqual(this.appearance, appearance))
            return;
        this.appearance = appearance;
        this.scope.apply(appearance);
        this.render();
    }
    getSearchText(): string {
        return GROUPS.flatMap(group => this.rows(group).map(row => this.rowSearchText(group,row))).join(' ');
    }
    private rowSearchText(group: Group, row: Row): string {
        return `${t(GROUP_LABELS[group])} ${t(row.label)} ${row.pin ? t('settingsPin') + ' Pin' : ''}`.toLocaleLowerCase();
    }
    search(query: string): void {
        this.query = query.trim().toLocaleLowerCase();
        const terms = this.query.split(/\s+/u).filter(Boolean);
        const match = GROUPS.find(group => this.rows(group).some(row => terms.every(term => this.rowSearchText(group,row).includes(term))));
        if (terms.length && match)
            this.active = match;
        this.render();
    }
    setReadOnly(value: boolean): void {
        if (this.readOnly === value)
            return;
        this.readOnly = value;
        this.render();
    }
    dispose(): void {
        this.disposed = true;
        this.sampleRevision++;this.samplePipeline.clear();
        this.clearPreviews();
        this.scope.dispose();
    }
    private clearPreviews(): void {
        for (const preview of this.previews)
            preview.dispose();
        this.previews = [];
    }
    private rows(group: Group): Row[] {
        if (group === 'Page')
            return PAGE_CONTROL_ACTIONS.map((action, i) => ({ path: pageFields[i] ? `chatgptBehavior.${pageFields[i]}` : '', label: pageLabels[i], icon: pageIcons[i], pin: action, pinsPath: 'chatgptBehavior.pinnedPageControls' }));
        if (group === 'Message')
            return [
                { path: 'behavior.showMessageToolbar', label: 'messageToolbarLabel', icon: moreHorizontalIcon },
                ...MESSAGE_CONTROL_ACTIONS.flatMap((action, i): Row[] => {
                    if (action === 'copy_prompt_reply') return [];
                    const row = { path: `behavior.messageControls.${action}`, label: messageLabels[i], icon: messageIcons[i], pin: action, pinsPath: 'behavior.pinnedMessageControls', parent: 'behavior.showMessageToolbar' };
                    return action === 'copy_markdown' ? [row,
                        { path: 'behavior.showCopyPng', label: 'btnCopyAsPng', icon: imageIcon, parent: row.path },
                        { path: 'behavior.messageControls.copy_prompt_reply', label: 'btnCopyPromptReply', icon: promptReplyIcon, parent: row.path },
                    ] : [row];
                }),
                { path: 'behavior.showMessageTimestamp', label: 'settingsMessageTimestamp', icon: moreHorizontalIcon },
                { path: 'behavior.showWordCount', label: 'wordCountLabel', icon: moreHorizontalIcon },
            ];
        if (group === 'Formula')
            return ['copyPng', 'copySvg', 'copyMathml', 'savePng', 'saveSvg'].map((action, i) => ({ path: `formula.${this.formulaContext}.${action}`, label: ['settingsFormulaButtonCopyPng', 'settingsFormulaButtonCopySvg', 'settingsFormulaButtonCopyMathml', 'settingsFormulaButtonSavePng', 'settingsFormulaButtonSaveSvg'][i], icon: i < 3 ? copyIcon : downloadIcon }));
        if (group === 'Selection')
            return [{ path: 'chatgptBehavior.showPageSelectionToolbar', label: 'chatgptShowPageSelectionToolbarLabel', icon: highlighterIcon }, ...['copy', 'annotation', 'highlight'].map((action, i) => ({ path: `reader.selectionToolbar.${action}`, label: ['settingsSelectionCopy', 'settingsSelectionAnnotation', 'settingsSelectionHighlight'][i], icon: [copyIcon, messageSquareTextIcon, highlighterIcon][i], parent: 'chatgptBehavior.showPageSelectionToolbar' }))];
        if (group === 'Directory')
            return [{ path: 'chatgptBehavior.showMessageStepper', label: 'chatgptShowMessageStepperLabel', icon: chevronDownIcon }];
        return [];
    }
    private value(path: string): unknown {
        return readPreferencePath(this.settings, path);
    }
    private enabled(row: Row): boolean {
        return (!row.path || Boolean(this.value(row.path))) && (row.path !== 'behavior.messageControls.export' || this.settings.behavior.showSaveMessages);
    }
    private render(): void {
        this.sampleRevision++;this.samplePipeline.cancel();
        this.clearPreviews();
        this.content.replaceChildren();
        for (const group of GROUPS) {
            let button = this.navigation.querySelector<HTMLButtonElement>(`[data-group="${group}"]`);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.dataset.group = group;
                button.addEventListener('click', () => {
                    this.active = group;
                    this.render();
                });
                this.navigation.append(button);
            }
            const label = t(GROUP_LABELS[group]);
            if (button.textContent !== label) {
                const icon = createIcon(GROUP_ICONS[group]);
                icon.classList.add('nav-icon');
                icon.setAttribute('aria-hidden', 'true');
                button.replaceChildren(icon, document.createTextNode(label));
            }
            button.setAttribute('aria-pressed', String(group === this.active));
        }
        const title = document.createElement('h3');
        title.textContent = t(GROUP_LABELS[this.active]);
        const preview = document.createElement('div');
        preview.className = 'preview';
        preview.dataset.role = 'buttons-preview';
        preview.setAttribute('aria-label', t('settingsPreview'));
        if (this.active === 'Formula') {
            const contexts = document.createElement('div');
            contexts.className = 'contexts';
            for (const context of ['assetActions', 'composerAssetActions'] as const) {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = t(context === 'assetActions' ? 'settingsFormulaResponse' : 'settingsFormulaComposer');
                b.setAttribute('aria-pressed', String(this.formulaContext === context));
                b.addEventListener('click', () => {
                    this.formulaContext = context;
                    this.render();
                });
                contexts.append(b);
            }
            preview.append(contexts);
        }
        const hasPreview=this.active!=='Directory';
        if(hasPreview)this.renderPreview(preview);
        const rows = document.createElement('div');
        rows.className = 'rows';
        for (const row of this.rows(this.active)) {
            const element = this.renderRow(row);
            const terms = this.query.split(/\s+/u).filter(Boolean);
            element.hidden = terms.length > 0 && !terms.every(term => this.rowSearchText(this.active,row).includes(term));
            rows.append(element);
        }
        this.content.append(title);if(hasPreview)this.content.append(preview);this.content.append(rows);
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = t(({ Page: 'settingsButtonsPinHint', Message: 'settingsButtonsPinHint', Formula: this.formulaContext==='composerAssetActions'?'settingsButtonsTypingFormulaHint':'settingsButtonsFormulaHint', Selection: 'settingsButtonsSelectionHint', Directory: 'settingsButtonsDirectoryHint' })[this.active]);
        this.content.append(hint);
    }
    private renderRow(row: Row): HTMLElement {
        const el = document.createElement('div');
        el.className = 'row';
        el.dataset.path = row.path;
        const label = document.createElement('span');
        label.className = 'row-label';
        label.append(createIcon(row.icon), document.createTextNode(t(row.label)));
        el.append(label);
        const parentEnabled = !row.parent || Boolean(this.value(row.parent));
        if (row.pin && row.pinsPath) {
            const pin = document.createElement('button');
            pin.type = 'button';
            pin.className = 'pin';
            pin.dataset.pin = row.pin;
            pin.append(createIcon(PIN));
            pin.setAttribute('aria-label', `${t('settingsPin')} · ${t(row.label)}`);
            const pinned = (this.value(row.pinsPath) as string[]).includes(row.pin);
            pin.setAttribute('aria-pressed', String(pinned));
            pin.disabled = this.readOnly || this.pending || !this.enabled(row) || !parentEnabled;
            pin.addEventListener('click', () => {
                const current = this.value(row.pinsPath!) as string[];
                void this.write(row.pinsPath!, pinned ? current.filter(id => id !== row.pin) : [...current, row.pin!]);
            });
            el.append(pin);
        }
        if (row.path) {
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'switch';
            toggle.dataset.role = 'button-visibility';
            toggle.setAttribute('role', 'switch');
            toggle.setAttribute('aria-label', t(row.label));
            toggle.setAttribute('aria-checked', String(this.enabled(row)));
            toggle.disabled = this.readOnly || this.pending || !parentEnabled || (!targetSurfacePolicy.binaryClipboardCopyActions && (row.path === 'behavior.showCopyPng' || /formula\..*\.copy(Png|Svg)$/.test(row.path)));
            toggle.append(document.createElement('span'));
            toggle.addEventListener('click', () => void this.write(row.path, !this.enabled(row)));
            el.append(toggle);
        }
        return el;
    }
    private async write(path: string, value: unknown): Promise<void> {
        if (this.pending || this.readOnly || this.disposed)
            return;
        const [category, ...fields] = path.split('.');
        let patch: Record<string, unknown> = {};
        let cursor = patch;
        for (const field of fields.slice(0, -1)) {
            const child: Record<string, unknown> = {};
            cursor[field] = child;
            cursor = child;
        }
        cursor[fields[fields.length - 1]] = value;
        if (path === 'behavior.messageControls.export')
            patch = { ...patch, showSaveMessages: value };
        this.pending = true;
        this.notice.textContent = '';
        this.render();
        try {
            if (!await this.save(category as SettingsCategory, patch))
                throw new Error('SAVE_FAILED');
            if (!this.disposed)
                this.settings = mergePortableSettings(this.settings, { [category]: patch }, [category]);
        }
        catch {
            if (!this.disposed)
                this.notice.textContent = t('settingsSaveFailed');
        }
        finally {
            this.pending = false;
            if (!this.disposed)
                this.render();
        }
    }
    private renderPreview(target: HTMLElement): void {
        if (this.active === 'Message') {
            for (const expanded of [false, true]) {
                const stage = document.createElement('div');
                stage.className = 'stage';
                const label = document.createElement('small');
                label.textContent = t(expanded ? 'settingsExpanded' : 'settingsCollapsed');
                stage.append(label);
                if (this.settings.behavior.showMessageToolbar) {
                    const actions = MESSAGE_CONTROL_ACTIONS.flatMap((id, i): MessageToolbarAction[] => {
                        if (id === 'copy_prompt_reply' || !this.settings.behavior.messageControls[id] || (id === 'export' && !this.settings.behavior.showSaveMessages)) return [];
                        const action: MessageToolbarAction = { id, label: t(messageLabels[i]), icon: messageIcons[i], onClick: async () => undefined };
                        if (id === 'copy_markdown') {
                            action.hoverActions = [];
                            if (this.settings.behavior.showCopyPng && targetSurfacePolicy.binaryClipboardCopyActions)
                                action.hoverActions.push({ id: 'copy_png', label: t('btnCopyAsPng'), icon: imageIcon, progress: false, onClick: async () => undefined });
                            if (this.settings.behavior.messageControls.copy_prompt_reply)
                                action.hoverActions.push({ id: 'copy_prompt_reply', label: t('btnCopyPromptReply'), icon: promptReplyIcon, placement: 'bottom', progress: false, onClick: async () => undefined });
                        }
                        return [action];
                    });
                    const toolbar = new MessageToolbar(this.appearance.theme, actions, { collapsible: true, preview: true, showStats: this.settings.behavior.showWordCount, showTimestamp: this.settings.behavior.showMessageTimestamp, pinnedActions: this.settings.behavior.pinnedMessageControls, themeOverrides: this.appearance.overrides });
                    stage.append(toolbar.getElement());
                    this.previews.push(toolbar);
                    toolbar.setStats(['128 ' + t('settingsPreviewChars')]);
                    toolbar.setMessageMetadata({ createdAt: Date.UTC(2026, 8, 30, 10, 30) });
                    if (expanded)
                        queueMicrotask(() => {
                            if (toolbar.getElement().isConnected)
                                toolbar.setExpanded(true);
                        });
                }
                target.append(stage);
            }
            return;
        }
        if (this.active === 'Page') {
            const style = document.createElement('style');
            style.textContent = getChatGPTPageControlsCss() + `.aimd-chatgpt-message-stepper {position:relative;inset:auto;z-index:auto;}  `;
            target.append(style);
            for (const expanded of [false, true]) {
                const stage = document.createElement('div');
                stage.className = 'stage';
                const label = document.createElement('small');
                label.textContent = t(expanded ? 'settingsExpanded' : 'settingsCollapsed');
                const host = document.createElement('div');
                host.className = 'aimd-chatgpt-message-stepper';
                host.dataset.visible = '1';
                host.dataset.expanded = expanded ? '1' : '0';
                host.dataset.hasPins = '1';
                const drawer = document.createElement('div');
                drawer.className = 'aimd-chatgpt-message-stepper__actions';
                for (const row of this.rows('Page'))
                    if (this.enabled(row) && (expanded || this.settings.chatgptBehavior.pinnedPageControls.includes(row.pin as PageControlAction))) {
                        const button = this.pageButton(row.icon, t(row.label));
                        button.dataset.action = row.pin;
                        if (row.pin === 'open-input-enhancement') button.dataset.active = resolveChatGPTInputEnhancement(this.settings.chatgptBehavior.inputEnhancement).enabled ? '1' : '0';
                        drawer.append(button);
                    }
                const brand = this.pageButton('', t('tabSettings'));
                const brandIcon = document.createElement('span');
                brandIcon.className = 'aimd-chatgpt-message-stepper__icon';
                brandIcon.append(createBrandIcon());
                brand.append(brandIcon);
                const gear = document.createElement('span');
                gear.className = 'aimd-chatgpt-message-stepper__settings';
                gear.append(createIcon(settingsIcon));
                brand.append(gear);
                brand.classList.add('aimd-chatgpt-message-stepper__trigger');
                host.append(drawer, brand);
                stage.append(label, host);
                target.append(stage);
            }
            return;
        }
        if (this.active === 'Formula') {
            if(this.formulaContext==='composerAssetActions'){this.renderTypingFormulaSample(target);return;}
            const actions = createFormulaAssetActionItems(() => undefined, this.settings.formula[this.formulaContext]);
            if (actions.length) {
                const portal = new ToolbarHoverActionPortal(this.appearance.theme, this.appearance.overrides);
                target.append(portal.createInlinePreview(actions));this.previews.push(portal);
            }
            const math = document.createElement('div');
            math.className = 'math-hover';
            const formula = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
            formula.setAttribute('display', 'block');
            formula.innerHTML = '<mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>';
            math.append(formula);
            const cursor = createIcon(CURSOR);
            cursor.classList.add('cursor');
            math.append(cursor);
            target.append(math);
            return;
        }
        if (this.active === 'Selection') {
            const sample = document.createElement('p');
            sample.className = 'selected-text';
            sample.textContent = t('settingsPreviewSelection');
            target.append(sample);
            if (this.settings.chatgptBehavior.showPageSelectionToolbar) {
                const enabled = this.settings.reader.selectionToolbar;
                if (enabled.copy || enabled.annotation || enabled.highlight) {
                    const toolbar = createPageSelectionToolbar({ left: 0, top: 0, copyLabel: t('btnCopy'), commentLabel: t('readerCommentAddTitle'), copyEnabled: enabled.copy, commentEnabled: enabled.annotation && this.settings.chatgptBehavior.pageAnnotationsEnabled, onCopy: () => undefined, onComment: () => undefined, onHighlight: enabled.highlight ? async () => undefined : undefined });
                    toolbar.style.position = 'relative';
                    toolbar.style.left = '';
                    toolbar.style.top = '';
                    target.prepend(toolbar);
                }
            }
            return;
        }
    }
    private renderTypingFormulaSample(target:HTMLElement):void {
        const selector=document.createElement('select');selector.className='formula-example-select';selector.setAttribute('aria-label',t('settingsFormulaExample'));
        for(const [value,key] of [['inline','settingsFormulaExampleInline'],['display','settingsFormulaExampleDisplay'],['completion','settingsFormulaExampleCompletion']] as const){const option=document.createElement('option');option.value=value;option.textContent=t(key);selector.append(option);}selector.value=this.sampleKind;selector.addEventListener('change',()=>{this.sampleKind=selector.value as typeof this.sampleKind;this.render();});target.append(selector);
        const root=document.createElement('section');root.className='formula-assistant';root.style.maxWidth=getFormulaAssistantMaxWidth();root.setAttribute('role','region');target.append(root);
        const effective=resolveChatGPTInputEnhancement(this.settings.chatgptBehavior.inputEnhancement);const revision=this.sampleRevision;
        if(this.readOnly||(!effective.formulaPreview&&!effective.formulaSuggestions)){const note=document.createElement('p');note.className='hint';note.textContent=t(this.readOnly?'settingsFormulaSettingsUnavailable':'settingsFormulaPreviewDisabled');root.append(note);return;}
        const source=this.sampleKind==='completion'?'\\sqrt{E=mc^2}':'E=mc^2';
        let view:FormulaComposerAssistantView={anchorRect:new DOMRect(),mathKind:this.sampleKind==='display'?'display':'inline',preview:effective.formulaPreview?{status:'loading'}:null,suggestions:[],selectedIndex:0};
        const paint=()=>{if(this.disposed||revision!==this.sampleRevision)return;renderFormulaAssistantView(root,view,{onSelect:()=>undefined,onExport:async()=>undefined,assetActions:this.settings.formula.composerAssetActions});};paint();
        if(effective.formulaSuggestions&&this.sampleKind==='completion')void loadLatexSnippetCatalog().then(catalog=>{view={...view,suggestions:searchLatexSnippets(catalog,'sqrt')};paint();},()=>undefined);
        if(effective.formulaPreview)void this.samplePipeline.request({source,displayMode:this.sampleKind==='display',fontSizePx:this.settings.formula.assetFontSizePx}).then(asset=>{view={...view,preview:{status:'ready',asset}};paint();},()=>{view={...view,preview:{status:'error'}};paint();});
    }
    private pageButton(icon: string, label: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'aimd-chatgpt-message-stepper__button sample-button';
        button.setAttribute('aria-label', label);
        if (icon) {
            const box = document.createElement('span');
            box.className = 'aimd-chatgpt-message-stepper__icon';
            box.append(createIcon(icon));
            button.append(box);
        }
        return button;
    }
}
const CSS = `:host { container-type:inline-size; display:block; font-family:var(--aimd-font-family-sans); color:var(--aimd-text-primary); } * {box-sizing:border-box;} [hidden]{display:none;} .layout {display:grid;grid-template-columns:minmax(0,calc(var(--aimd-size-control-icon-toolbar)*5 + var(--aimd-space-3)*2)) minmax(0,1fr);gap:0;} .group-content{min-width:0;padding:var(--aimd-space-4) var(--aimd-space-5);} nav::-webkit-scrollbar{display:none;} nav{display:flex;flex-direction:column;scrollbar-width:none;gap:calc(var(--aimd-space-1)/2);align-self:stretch;padding:var(--aimd-space-4) var(--aimd-space-3) var(--aimd-space-4) var(--aimd-space-5);border-inline-end:1px solid var(--aimd-workspace-border);} button{font:inherit;cursor:pointer;} button:focus-visible{outline:2px solid var(--aimd-focus-ring);outline-offset:2px;} nav button{display:flex;align-items:center;gap:var(--aimd-space-2);border:0;background:transparent;color:var(--aimd-text-secondary);padding:var(--aimd-space-2) var(--aimd-space-3);border-radius:var(--aimd-radius-md);text-align:start;font-size:var(--aimd-text-sm);line-height:var(--aimd-leading-normal);} nav button:hover{background:var(--aimd-button-icon-hover);color:var(--aimd-text-primary);} .nav-icon{display:inline-flex;flex:none;color:var(--aimd-text-tertiary);} .nav-icon svg{width:var(--aimd-size-control-glyph-panel);height:var(--aimd-size-control-glyph-panel);} nav button[aria-pressed=true] .nav-icon{color:color-mix(in srgb,var(--aimd-interactive-primary) 60%,var(--aimd-text-primary));} nav button[aria-pressed=true]{background:var(--aimd-interactive-selected);color:color-mix(in srgb,var(--aimd-interactive-primary) 60%,var(--aimd-text-primary));font-weight:var(--aimd-font-semibold);} h3{font-size:var(--aimd-text-base);line-height:var(--aimd-leading-normal);margin:0 0 var(--aimd-space-4);} .formula-example-select{font:inherit;font-size:var(--aimd-text-xs);border:1px solid var(--aimd-workspace-border);border-radius:var(--aimd-radius-lg);background:var(--aimd-workspace-card);color:var(--aimd-text-primary);padding:var(--aimd-space-2);} .preview>.formula-assistant{width:100%;max-width:100%;} .preview{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--aimd-space-5);padding:var(--aimd-space-6);min-height:calc(var(--aimd-size-control-icon-toolbar)*5);background:var(--aimd-workspace-surface);border:1px solid var(--aimd-workspace-border);border-radius:var(--aimd-radius-xl);overflow:visible;margin-bottom:var(--aimd-space-4);} .stage{width:100%;display:flex;align-items:center;justify-content:space-between;gap:var(--aimd-space-6);} .contexts{display:flex;align-self:center;gap:var(--aimd-space-1);padding:var(--aimd-space-1);background:var(--aimd-workspace-card);border:1px solid var(--aimd-workspace-border);border-radius:var(--aimd-radius-full);} .contexts button{font-size:var(--aimd-text-xs);border:0;border-radius:var(--aimd-radius-full);padding:var(--aimd-space-2) var(--aimd-space-3);color:var(--aimd-text-secondary);background:transparent;} .contexts button[aria-pressed=true]{background:var(--aimd-interactive-selected);color:var(--aimd-text-primary);} small,.hint,.notice{font-size:var(--aimd-text-xs);line-height:var(--aimd-leading-normal);color:var(--aimd-text-secondary);} .rows{display:flex;flex-direction:column;} .row{display:flex;align-items:center;gap:var(--aimd-space-3);padding:var(--aimd-space-3) 0;border-bottom:1px solid var(--aimd-workspace-border);} .row-label{display:flex;gap:var(--aimd-space-3);align-items:center;flex:1;font-size:var(--aimd-text-sm);} svg{width:var(--aimd-size-control-glyph-panel);height:var(--aimd-size-control-glyph-panel);} .sample-button{--_page-control-size:var(--aimd-size-control-icon-toolbar);--_page-control-glyph:var(--aimd-size-control-glyph-panel);} .pin,.sample-button{display:inline-flex;align-items:center;justify-content:center;width:var(--aimd-size-control-icon-toolbar);height:var(--aimd-size-control-icon-toolbar);padding:var(--aimd-space-1);border:1px solid var(--aimd-workspace-border);background:var(--aimd-workspace-card);border-radius:var(--aimd-radius-full);color:var(--aimd-text-secondary);} .pin>span{display:flex;align-items:center;justify-content:center;line-height:0;} .pin svg{display:block;} .pin[aria-pressed=true]{color:var(--aimd-text-on-primary);background:var(--aimd-interactive-primary);border-color:var(--aimd-interactive-primary);} button:disabled{opacity:var(--aimd-opacity-disabled);cursor:default;} .switch{width:calc(var(--aimd-size-control-icon-toolbar)*1.25);height:calc(var(--aimd-size-control-icon-toolbar)*0.7);border:0;border-radius:var(--aimd-radius-full);padding:var(--aimd-space-1);background:var(--aimd-border-strong);display:flex;align-items:center;justify-content:start;} .switch[aria-checked=true]{background:var(--aimd-interactive-primary);justify-content:end;} .switch span{height:100%;aspect-ratio:1;border-radius:var(--aimd-radius-full);background:var(--aimd-text-on-primary);} .math-hover{position:relative;color:color-mix(in srgb,var(--aimd-interactive-primary),var(--aimd-text-primary) 25%);border:1px solid var(--aimd-interactive-primary);border-radius:var(--aimd-radius-sm);padding:var(--aimd-space-3) var(--aimd-space-5);font-size:calc(var(--aimd-text-xl)*1.5);} .cursor{position:absolute;top:calc(var(--aimd-space-3)*-1);right:calc(var(--aimd-space-3)*-1);} .selected-text{color:var(--aimd-text-primary);background:var(--aimd-interactive-selected);padding:var(--aimd-space-1) var(--aimd-space-3);} .directory-sample{display:flex;flex-direction:column;gap:var(--aimd-space-2);align-self:end;color:var(--aimd-text-secondary);} .sample-actions{display:flex;gap:var(--aimd-space-1);justify-content:end;width:100%;} .composer-sample{width:100%;border:1px solid var(--aimd-workspace-border);background:var(--aimd-workspace-card);border-radius:var(--aimd-radius-xl);padding:var(--aimd-space-4);color:var(--aimd-text-secondary);display:grid;gap:var(--aimd-space-4);} .notice:empty{display:none;} @container(max-width:560px){.layout{grid-template-columns:minmax(0,1fr);} nav{flex-direction:row;overflow-x:auto;padding:var(--aimd-space-4) var(--aimd-space-5);border-inline-end:0;padding-bottom:var(--aimd-space-2);border-bottom:1px solid var(--aimd-workspace-border);} nav button{white-space:nowrap;flex:none;} .stage{flex-direction:column;align-items:stretch;gap:var(--aimd-space-3);} .stage>.aimd-message-toolbar-host,.stage>.aimd-chatgpt-message-stepper{align-self:flex-end;} .preview{padding:var(--aimd-space-4);}} @media(max-width:560px){.layout{grid-template-columns:minmax(0,1fr);} nav{flex-direction:row;overflow-x:auto;padding:var(--aimd-space-4) var(--aimd-space-5);border-inline-end:0;padding-bottom:var(--aimd-space-2);border-bottom:1px solid var(--aimd-workspace-border);} nav button{white-space:nowrap;flex:none;} .preview{padding:var(--aimd-space-4);} }`;
