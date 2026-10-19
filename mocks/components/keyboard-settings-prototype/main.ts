// One interaction prototype inside the real Settings fixture. State is page-local.
import css from './prototype.css?inline';
import { COMMANDS, bindingKey, findConflicts, formatBinding, normalizeKeyboardEvent, validateBinding, type Binding, type Command } from './model';
import { getFlatWorkflowCss } from '../../../src/ui/content/components/styles/flatWorkflowCss';
import { AppearanceScope } from '../../../src/style/appearanceScope';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { keyboardIcon, highlighterIcon, bookOpenIcon, textCursorIcon, settingsIcon, checkIcon } from '../../../src/assets/workspaceIcons';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const labels = { selection: '选区操作', reading: '阅读与消息', writing: '输入与提示词', workspace: '工作区' };
const scopes = { selection: '正文有选区时 · 页面与 Reader', reading: '阅读消息时 · 不在输入框中', composer: '仅在 ChatGPT 输入框中', page: '阅读页面时 · 不在输入框中' };
const groupIcons = { selection: highlighterIcon, reading: bookOpenIcon, writing: textCursorIcon, workspace: settingsIcon };
const bindings: Record<string, Binding | null> = Object.fromEntries(COMMANDS.map(c => [c.id, c.defaultBinding]));
const disabled = new Set<string>();
let enabled = true;
let automatic = true;
let composing = false;
let theme: 'light' | 'dark' = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
let record: { id: string; candidate: Binding | null; pending: Binding | null; held: Set<string>; phase: 'recording' | 'ready' } | null = null;
let toastTimer: ReturnType<typeof setTimeout>;
let dismissedDemoToken = '';
let manualSuggestions = false;
let suggestionIndex = 0;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const keycaps = (binding: Binding) => formatBinding(binding, isMac).map(k => `<kbd>${escapeHtml(k)}</kbd>`).join('');
const icon = (svg: string) => `<span class="aimd-icon">${svg}</span>`;

async function waitForSettings(): Promise<ShadowRoot> {
    for (let i = 0; i < 150; i++) {
        const shadow = document.getElementById('aimd-bookmarks-panel-host')?.shadowRoot;
        if (shadow?.querySelector('.settings-category-navigation [data-category="controls"]') && shadow.querySelector('.settings-panel-scroll')) return shadow;
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
    throw new Error('Settings fixture did not mount.');
}

function mountPrototype(shadow: ShadowRoot): () => void {
const lifetime = new AbortController();
const host = shadow.host as HTMLElement;
const appearance = AppearanceScope.forShadowRoot(shadow, { styleId: 'keyboard-prototype-appearance' });
const style = document.createElement('style'); style.textContent = `${getFlatWorkflowCss()}\n${css}`; shadow.append(style);
const settings = shadow.querySelector<HTMLElement>('.aimd-settings')!;
const header = shadow.querySelector<HTMLElement>('.settings-catalog-header')!;
const scroll = shadow.querySelector<HTMLElement>('.settings-panel-scroll')!;
const catalog = shadow.querySelector<HTMLElement>('.settings-catalog')!;
const search = header.querySelector<HTMLInputElement>('input')!;
const controlsNav = shadow.querySelector<HTMLButtonElement>('.settings-category-navigation [data-category="controls"]')!;
controlsNav.setAttribute('aria-label', '按钮与快捷键');
controlsNav.querySelector('.workspace-navigation-label')!.textContent = '按钮与快捷键';

const tabs = document.createElement('div'); tabs.className = 'keyboard-tabs flat-workflow__tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '按钮与快捷键');
tabs.innerHTML = '<button class="flat-workflow__tab" role="tab" id="prototype-buttons-tab" aria-controls="prototype-buttons-panel" aria-selected="false" tabindex="-1" data-tab="buttons">按钮</button><button class="flat-workflow__tab" role="tab" id="prototype-keyboard-tab" aria-controls="prototype-keyboard-panel" aria-selected="true" data-tab="keyboard">快捷键</button>';
header.append(tabs);
const view = document.createElement('section'); view.id = 'prototype-keyboard-panel'; view.className = 'keyboard-prototype flat-workflow'; view.setAttribute('role','tabpanel'); view.setAttribute('aria-labelledby','prototype-keyboard-tab');
view.innerHTML = `
 <div class="keyboard-overview">
   <div class="keyboard-overview__label"><button class="keyboard-switch" role="switch" aria-label="启用快捷键" aria-checked="true" data-action="toggle-all"></button><div><strong>启用快捷键</strong><p class="keyboard-caption" data-role="global-hint">按场景生效，输入文字时不会触发阅读操作。</p></div></div>
   <button class="keyboard-text-button" data-action="reset-all">恢复全部默认</button>
 </div>
 <div class="keyboard-reset" role="group" aria-label="确认恢复默认" hidden data-role="reset-confirm"><strong>恢复全部默认？</strong><p class="keyboard-caption">还原 12 项绑定，并重新开启快捷键与自动联想。自定义组合会被清除。</p><div class="keyboard-recorder__actions"><button class="secondary-btn" data-action="cancel-reset">取消</button><button class="primary-btn" data-action="confirm-reset">恢复默认</button></div></div>
 <div data-role="command-groups"></div>
 <p class="keyboard-empty" hidden data-role="empty">没有找到匹配的功能或组合键。</p>
 <section class="keyboard-section" data-role="automatic-section"><div class="keyboard-section__title">${icon(textCursorIcon)}<h4>自动联想</h4></div><div class="keyboard-list"><div class="keyboard-auto-row"><div><strong>输入反斜杠时联想提示词</strong><p class="keyboard-caption">关闭后不自动弹出，仍可用快捷键主动打开候选或提示词库。</p></div><button class="keyboard-switch" role="switch" aria-label="反斜杠自动联想" aria-checked="true" data-action="toggle-auto"></button></div></div></section>
 <section class="keyboard-section" data-role="test-section"><div class="keyboard-section__title">${icon(keyboardIcon)}<h4>试按一下</h4></div><div class="keyboard-list"><div class="keyboard-auto-row keyboard-test"><div class="keyboard-test__header"><p class="keyboard-caption">只显示识别结果，不执行真实功能。</p><select aria-label="试按场景"><option value="selection">正文选区</option><option value="reading">阅读消息</option><option value="composer">ChatGPT 输入框</option><option value="page">页面</option></select></div><textarea class="keyboard-test__input" aria-label="快捷键试按区域" placeholder="点击这里按下组合键；切到输入框场景后，可输入反斜杠体验联想。" rows="2"></textarea><div class="keyboard-suggestions" role="listbox" aria-label="示例提示词" hidden><button role="option" aria-selected="true" data-prompt="请总结以下内容的重点。">总结重点 <span class="keyboard-caption">\\summary</span></button><button role="option" aria-selected="false" data-prompt="请将以下内容翻译成英文。">翻译成英文 <span class="keyboard-caption">\\translate</span></button></div><p class="keyboard-caption" role="status" aria-live="polite" data-role="test-result">等待试按。可以先为“添加注释”录入一个组合键。</p></div></div><p class="keyboard-caption" style="margin-top:var(--aimd-space-3)">检查插件内重复与常见保留组合；系统或其他扩展占用需要实际试按确认。</p></section>`;
scroll.append(view);
catalog.id = 'prototype-buttons-panel';
const footer = document.createElement('footer'); footer.className = 'keyboard-footer'; footer.innerHTML = '<span>交互原型 · 改动仅在本页生效</span><div class="keyboard-footer__tools"><span data-role="binding-count"></span><button data-action="theme">切换深色</button></div>';
settings.append(footer);
const toast = document.createElement('div'); toast.className = 'keyboard-toast'; toast.setAttribute('role','status'); toast.setAttribute('aria-live','polite'); toast.hidden = true; settings.append(toast);
const groupsRoot = view.querySelector<HTMLElement>('[data-role="command-groups"]')!;
const testInput = view.querySelector<HTMLTextAreaElement>('textarea')!;
const testScope = view.querySelector<HTMLSelectElement>('select')!;
const suggestions = view.querySelector<HTMLElement>('.keyboard-suggestions')!;
const result = view.querySelector<HTMLElement>('[data-role="test-result"]')!;
let keyboardActive = true;
const heading = header.querySelector('h2')!;
const headingObserver = new MutationObserver(()=>{
    if(!tabs.hidden && !search.value && heading.textContent!=='按钮与快捷键')heading.textContent='按钮与快捷键';
});
headingObserver.observe(heading,{childList:true,subtree:true,characterData:true});

function effectiveBindings(): Record<string,Binding|null> {
    return Object.fromEntries(COMMANDS.map(c => [c.id, disabled.has(c.id) ? null : bindings[c.id]]));
}
function notify(message: string): void {
    clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}
function updateSummary(): void {
    view.dataset.enabled = String(enabled);
    view.querySelector('[data-action="toggle-all"]')!.setAttribute('aria-checked',String(enabled));
    view.querySelector('[data-action="toggle-auto"]')!.setAttribute('aria-checked',String(automatic));
    view.querySelector('[data-role="global-hint"]')!.textContent = enabled ? '按场景生效，输入文字时不会触发阅读操作。' : '已关闭，保留所有绑定。重新开启即可继续使用。';
    footer.querySelector('[data-role="binding-count"]')!.textContent = `${COMMANDS.filter(c => bindings[c.id] && !disabled.has(c.id)).length} 项已设置`;
}
function renderGroups(): void {
    groupsRoot.innerHTML = (Object.keys(labels) as Command['group'][]).map(group => `<section class="keyboard-section" data-group="${group}"><div class="keyboard-section__title">${icon(groupIcons[group])}<h4>${labels[group]}</h4></div><div class="keyboard-list">${COMMANDS.filter(c => c.group === group).map(c => {
        const binding = bindings[c.id]; const off = disabled.has(c.id);
        const changed = off || (binding ? bindingKey(binding) : '') !== (c.defaultBinding ? bindingKey(c.defaultBinding) : '');
        return `<div class="keyboard-row" data-command="${c.id}"><div class="keyboard-row__summary"><div class="keyboard-row__label"><strong>${c.label}${off ? ' <span class="keyboard-status-pill">已停用</span>' : ''}</strong><p class="keyboard-caption">${scopes[c.scope]}</p></div><div class="keyboard-row__actions"><button class="keyboard-binding" data-action="record" data-id="${c.id}" data-unset="${!binding}" data-off="${off}" aria-label="${c.label}：${binding ? formatBinding(binding,isMac).join(' ') : '未设置'}，录入快捷键" aria-expanded="false">${binding ? keycaps(binding) : '录入快捷键'}</button>${binding ? `<button class="keyboard-text-button" data-action="toggle-command" data-id="${c.id}" aria-label="${off ? '启用' : '停用'}${c.label}">${off ? '启用' : '停用'}</button>` : ''}<button class="keyboard-text-button" data-action="reset-command" data-id="${c.id}" aria-label="恢复${c.label}默认" ${changed ? '' : 'disabled'}>重置</button></div></div></div>`;
    }).join('')}</div></section>`).join('');
    updateSummary(); filterRows();
}
function filterRows(): void {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const c of COMMANDS) {
        const row = groupsRoot.querySelector<HTMLElement>(`[data-command="${c.id}"]`)!;
        const text = `${c.label} ${c.description} ${labels[c.group]} ${scopes[c.scope]} ${bindings[c.id] ? formatBinding(bindings[c.id]!,isMac).join(' ') : '未设置'} ${disabled.has(c.id) ? '已停用' : ''}`.toLowerCase();
        row.hidden = !terms.every(t => text.includes(t)); if (!row.hidden) count++;
    }
    groupsRoot.querySelectorAll<HTMLElement>('[data-group]').forEach(group => { group.hidden = !group.querySelector('.keyboard-row:not([hidden])'); });
    const automaticMatch=terms.every(t => '自动联想 反斜杠 输入 提示词'.includes(t));
    view.querySelector<HTMLElement>('[data-role="empty"]')!.hidden = count > 0 || automaticMatch;
    view.querySelector<HTMLElement>('[data-role="automatic-section"]')!.hidden = terms.length > 0 && !automaticMatch;
    view.querySelector<HTMLElement>('[data-role="test-section"]')!.hidden = terms.length > 0;
}
function cancelRecord(restoreFocus = true): void {
    const id = record?.id; record = null;
    view.querySelector('.keyboard-recorder')?.remove();
    if (id) { const button = groupsRoot.querySelector<HTMLButtonElement>(`[data-action="record"][data-id="${id}"]`); button?.setAttribute('aria-expanded','false'); if (restoreFocus) button?.focus({preventScroll:true}); }
}
function beginRecord(id: string, initial?: Binding): void {
    cancelRecord(false);
    view.querySelector<HTMLElement>('[data-role="reset-confirm"]')!.hidden = true;
    record = { id, candidate: initial ?? null, pending: null, held: new Set(), phase: initial ? 'ready' : 'recording' };
    const row = groupsRoot.querySelector<HTMLElement>(`[data-command="${id}"]`)!;
    row.querySelector('[data-action="record"]')!.setAttribute('aria-expanded','true');
    const editor = document.createElement('div'); editor.className = 'keyboard-recorder'; editor.setAttribute('role','group'); editor.setAttribute('aria-label',`录入${COMMANDS.find(c=>c.id===id)!.label}`);
    editor.innerHTML = '<div class="keyboard-capture" tabindex="0" role="group" aria-label="快捷键录入区域" aria-describedby="keyboard-record-message"></div><p class="keyboard-recorder__message" id="keyboard-record-message" role="status" aria-live="polite"></p><div class="keyboard-recorder__actions"><button class="keyboard-text-button" data-action="rerecord">重新录入</button><button class="secondary-btn" data-action="cancel-record">取消</button><button class="primary-btn" data-action="save-record" disabled>保存快捷键</button></div>';
    row.append(editor); updateRecorder(); editor.querySelector<HTMLElement>('.keyboard-capture')!.focus({preventScroll:true}); editor.scrollIntoView({block:'nearest',behavior:'auto'});
}
function recordValidation() {
    if (!record?.candidate) return {level:'waiting',message:'按下组合键，松开后确认。Esc 取消，Tab 离开录入。',conflicts:[] as Command[]};
    const validation = validateBinding(record.candidate,isMac);
    if (!record.candidate.primary && !record.candidate.alt && !record.candidate.control && record.candidate.key.startsWith('Arrow') && !['reading.previous','reading.next'].includes(record.id)) return {level:'blocked',message:'裸方向键用于消息导航，请为这个功能加上修饰键。',conflicts:[] as Command[]};
    const conflicts = findConflicts(record.id,record.candidate,effectiveBindings());
    if (validation.level === 'blocked') return {...validation,conflicts:[] as Command[]};
    if (conflicts.length) return {level:'conflict',message:`与“${conflicts.map(c=>c.label).join('”、“')}”冲突，生效范围重叠。替换后将停用原绑定。`,conflicts};
    return {...validation,message:validation.level==='ok'?'插件内无冲突。保存后可在下方试按。':validation.message,conflicts};
}
function updateRecorder(preview?: string[]): void {
    if (!record) return;
    const editor = view.querySelector<HTMLElement>('.keyboard-recorder')!;
    const capture = editor.querySelector<HTMLElement>('.keyboard-capture')!;
    const binding = record.pending ?? record.candidate;
    capture.innerHTML = preview?.length ? preview.map(k=>`<kbd>${escapeHtml(k)}</kbd>`).join('') : binding ? keycaps(binding) : `${icon(keyboardIcon)}<span>在这里按下组合键</span>`;
    const validation = recordValidation();
    const message = editor.querySelector<HTMLElement>('.keyboard-recorder__message')!;
    const ready = record.phase === 'ready' && !!record.candidate;
    message.dataset.level = ready ? validation.level : 'waiting';
    message.innerHTML = `${ready ? icon(validation.level === 'ok' ? checkIcon : keyboardIcon) : ''}<span>${escapeHtml(ready ? validation.message : '按下组合键，松开后确认。Esc 取消，Tab 离开录入。')}</span>`;
    const save = editor.querySelector<HTMLButtonElement>('[data-action="save-record"]')!;
    save.disabled = !ready || validation.level === 'blocked'; save.textContent = validation.level === 'conflict' ? '替换并保存' : '保存快捷键';
}
function saveRecord(): void {
    if (!record?.candidate || record.phase !== 'ready') return;
    const validation = recordValidation(); if (validation.level === 'blocked') return;
    const {id,candidate} = record; validation.conflicts.forEach(c => disabled.add(c.id)); bindings[id] = {...candidate}; disabled.delete(id);
    cancelRecord(false); renderGroups(); groupsRoot.querySelector<HTMLButtonElement>(`[data-action="record"][data-id="${id}"]`)!.focus({preventScroll:true});
    notify(validation.conflicts.length ? '已保存，原冲突绑定已停用' : '快捷键已保存');
}
function setTab(keyboard: boolean): void {
    cancelRecord(false); keyboardActive = keyboard; view.hidden = !keyboard; catalog.hidden = keyboard; footer.hidden = !keyboard;
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach(button => { const active = button.dataset.tab === (keyboard ? 'keyboard' : 'buttons'); button.setAttribute('aria-selected',String(active)); button.tabIndex = active ? 0 : -1; });
    search.placeholder = keyboard ? '搜索功能或组合键' : '搜索设置'; search.setAttribute('aria-label',search.placeholder);
    if (keyboard) filterRows();
}
tabs.addEventListener('click',e => { const button = (e.target as Element).closest<HTMLButtonElement>('[data-tab]'); if (button) setTab(button.dataset.tab === 'keyboard'); });
tabs.addEventListener('keydown',e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setTab(!keyboardActive); tabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')!.focus(); } });
controlsNav.addEventListener('click',() => { tabs.hidden = false; header.querySelector('h2')!.textContent = '按钮与快捷键'; setTab(keyboardActive); });
shadow.querySelectorAll<HTMLButtonElement>('.settings-category-navigation button').forEach(button => { if (button !== controlsNav) button.addEventListener('click',() => { cancelRecord(false); tabs.hidden = true; view.hidden = true; footer.hidden = true; catalog.hidden = false; }); });
search.addEventListener('input',() => { cancelRecord(false); if (keyboardActive && !tabs.hidden) { catalog.hidden = true; filterRows(); } });

view.addEventListener('click',e => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action]'); if (!button || button.disabled) return;
    const {action,id} = button.dataset;
    if (action === 'record') beginRecord(id!);
    if (action === 'cancel-record') cancelRecord();
    if (action === 'rerecord' && record) beginRecord(record.id);
    if (action === 'save-record') saveRecord();
    if (action === 'toggle-all') { cancelRecord(false); enabled = !enabled; updateSummary(); notify(enabled ? '快捷键已开启' : '快捷键已关闭，绑定已保留'); }
    if (action === 'toggle-auto') { automatic = !automatic; manualSuggestions = false; updateSummary(); updateSuggestions(); notify(automatic ? '自动联想已开启' : '自动联想已关闭，仍可手动打开'); }
    if (action === 'toggle-command' && id) {
        cancelRecord(false);
        if (disabled.has(id) && bindings[id] && findConflicts(id,bindings[id]!,effectiveBindings()).length) { beginRecord(id,bindings[id]!); return; }
        const turningOn = disabled.delete(id); if (!turningOn) disabled.add(id); renderGroups(); groupsRoot.querySelector<HTMLButtonElement>(`[data-action="toggle-command"][data-id="${id}"]`)?.focus({preventScroll:true}); notify(turningOn ? '已启用此快捷键' : '已停用，原组合已保留');
    }
    if (action === 'reset-command' && id) {
        cancelRecord(false); const c = COMMANDS.find(c=>c.id===id)!;
        if (c.defaultBinding && findConflicts(id,c.defaultBinding,effectiveBindings()).length) { beginRecord(id,c.defaultBinding); return; }
        bindings[id] = c.defaultBinding; disabled.delete(id); renderGroups(); groupsRoot.querySelector<HTMLButtonElement>(`[data-action="record"][data-id="${id}"]`)?.focus({preventScroll:true}); notify('此项已恢复默认');
    }
    if (action === 'reset-all') { cancelRecord(false); const confirm = view.querySelector<HTMLElement>('[data-role="reset-confirm"]')!; confirm.hidden = false; confirm.querySelector<HTMLButtonElement>('[data-action="cancel-reset"]')!.focus(); confirm.scrollIntoView({block:'nearest'}); }
    if (action === 'cancel-reset') { view.querySelector<HTMLElement>('[data-role="reset-confirm"]')!.hidden = true; view.querySelector<HTMLButtonElement>('[data-action="reset-all"]')!.focus(); }
    if (action === 'confirm-reset') { COMMANDS.forEach(c=>{bindings[c.id] = c.defaultBinding;}); disabled.clear(); enabled = true; automatic = true; manualSuggestions = false; dismissedDemoToken = ''; renderGroups(); updateSuggestions(); view.querySelector<HTMLElement>('[data-role="reset-confirm"]')!.hidden = true; view.querySelector<HTMLButtonElement>('[data-action="reset-all"]')!.focus(); notify('已恢复全部默认'); }
});
window.addEventListener('keydown',e => {
    if (!record || !host.isConnected || host.hidden || !view.getClientRects().length) return;
    if (composing || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancelRecord(); return; }
    if (!e.composedPath().some(n => n instanceof HTMLElement && n.classList.contains('keyboard-capture'))) return;
    if (e.key === 'Tab') { cancelRecord(); return; }
    e.preventDefault(); e.stopImmediatePropagation(); if (e.repeat) return;
    if (record.phase === 'ready') { record.candidate = null; record.pending = null; record.held.clear(); record.phase = 'recording'; }
    record.held.add(e.code || e.key);
    const binding = normalizeKeyboardEvent(e,isMac);
    if (binding) { record.pending = binding; record.phase = 'recording'; updateRecorder(); }
    else if (!record.pending) updateRecorder([e.metaKey ? '⌘' : '',e.ctrlKey ? (isMac ? '⌃' : 'Ctrl') : '',e.altKey ? (isMac ? '⌥' : 'Alt') : '',e.shiftKey ? (isMac ? '⇧' : 'Shift') : ''].filter(Boolean));
},{capture:true,signal:lifetime.signal});
window.addEventListener('keyup',e => {
    if (!record) return; record.held.delete(e.code || e.key);
    // Some macOS browsers omit the letter keyup while Command is held.
    if (['Meta','Control','Alt','Shift'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) record.held.clear();
    if (record.pending && record.held.size === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) { record.candidate = record.pending; record.pending = null; record.phase = 'ready'; updateRecorder(); }
},{capture:true,signal:lifetime.signal});
shadow.addEventListener('compositionstart',()=>{composing=true;updateSuggestions();},{capture:true,signal:lifetime.signal});
shadow.addEventListener('compositionend',()=>{composing=false; updateSuggestions();},{capture:true,signal:lifetime.signal});
window.addEventListener('blur',()=>{if(record) cancelRecord(false);},{signal:lifetime.signal});
shadow.addEventListener('keydown',event => { const e=event as KeyboardEvent; if (e.key === 'Escape' && view.getClientRects().length && !view.querySelector<HTMLElement>('[data-role="reset-confirm"]')!.hidden) { e.preventDefault(); e.stopPropagation(); view.querySelector<HTMLButtonElement>('[data-action="cancel-reset"]')!.click(); } },{capture:true,signal:lifetime.signal});
shadow.addEventListener('click',event=>{
    const button=(event.target as Element).closest('button');
    if(button?.closest('.bookmarks-sidebar') && button!==controlsNav){cancelRecord(false);composing=false;manualSuggestions=false;suggestions.hidden=true;view.querySelector<HTMLElement>('[data-role="reset-confirm"]')!.hidden=true;}
},{capture:true,signal:lifetime.signal});

function updateSuggestions(): void {
    const token = testInput.value.slice(0,testInput.selectionStart).match(/(?:^|\s)(\\[^\s\\]*)$/)?.[1] ?? '';
    suggestions.hidden = testScope.value !== 'composer' || composing || !(manualSuggestions || (automatic && token && dismissedDemoToken !== `${testInput.selectionStart}:${token}`));
    suggestions.querySelectorAll('button').forEach((button,i)=>button.setAttribute('aria-selected',String(i===suggestionIndex)));
    if (!token) dismissedDemoToken = '';
}
function acceptSuggestion(): void {
    const button = suggestions.querySelectorAll<HTMLButtonElement>('button')[suggestionIndex]!;
    const start = testInput.selectionStart; const end = testInput.selectionEnd;
    const token = testInput.value.slice(0,start).match(/(?:^|\s)(\\[^\s\\]*)$/)?.[1] ?? '';
    testInput.setRangeText(button.dataset.prompt!,start-token.length,end,'end'); manualSuggestions=false; suggestions.hidden=true; testInput.focus(); result.textContent='已插入示例提示词，未发送。';
}
testInput.addEventListener('input',()=>{manualSuggestions=false; if(!composing) updateSuggestions();});
testInput.addEventListener('click',()=>updateSuggestions());
testScope.addEventListener('change',()=>{manualSuggestions=false; updateSuggestions(); result.textContent='场景已切换，等待试按。';});
suggestions.addEventListener('mousedown',e=>e.preventDefault());
suggestions.addEventListener('click',e=>{ const button=(e.target as Element).closest('button'); if(button){suggestionIndex=Array.from(suggestions.querySelectorAll('button')).indexOf(button);acceptSuggestion();} });
testInput.addEventListener('keydown',e=>{
    if(composing || e.isComposing || e.keyCode===229 || e.repeat) return;
    if(!suggestions.hidden && ['Escape','Enter','Tab','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();e.stopPropagation();
        if(e.key==='Escape'){ dismissedDemoToken=`${testInput.selectionStart}:${testInput.value.slice(0,testInput.selectionStart).match(/(?:^|\s)(\\[^\s\\]*)$/)?.[1]??''}`; manualSuggestions=false;suggestions.hidden=true;result.textContent='候选已关闭，输入内容保留。'; }
        else if(e.key==='ArrowUp'||e.key==='ArrowDown'){suggestionIndex=(suggestionIndex+(e.key==='ArrowDown'?1:-1)+2)%2;updateSuggestions();}
        else acceptSuggestion(); return;
    }
    const binding=normalizeKeyboardEvent(e,isMac); if(!binding) return;
    e.stopPropagation();
    if(!enabled){result.textContent='快捷键已关闭，绑定保留。自动联想仍由独立开关控制。';return;}
    const scope=testScope.value;
    const candidates=COMMANDS.filter(c=>bindings[c.id] && !disabled.has(c.id) && bindingKey(bindings[c.id]!)===bindingKey(binding));
    const command=candidates.find(c=>scope==='composer'?c.scope==='composer':c.scope==='page'||c.scope==='reading'&&['reading','selection'].includes(scope)||c.scope==='selection'&&scope==='selection');
    if(command)e.preventDefault();
    result.textContent=command?`识别成功：${command.label} · ${scopes[command.scope]}`:candidates.length?`已识别 ${formatBinding(binding,isMac).join(' ')}，当前场景不生效。`:`已识别 ${formatBinding(binding,isMac).join(' ')}，尚未绑定功能。`;
    if(command?.id==='writing.autocomplete'||command?.id==='writing.promptLibrary'){manualSuggestions=true;updateSuggestions();}
});
footer.addEventListener('click',e=>{if((e.target as Element).closest('[data-action="theme"]')){cancelRecord(false);theme=theme==='light'?'dark':'light';host.dataset.aimdTheme=theme;document.body.dataset.theme=theme;appearance.apply(createAppearanceSnapshot(theme));footer.querySelector('button')!.textContent=theme==='light'?'切换深色':'切换浅色';}});
renderGroups(); controlsNav.click(); setTab(true);
host.dataset.aimdTheme=theme; document.body.dataset.theme=theme; appearance.apply(createAppearanceSnapshot(theme));
footer.querySelector('button')!.textContent=theme==='light'?'切换深色':'切换浅色';
document.title='AI-MarkDone · 快捷键设置交互原型';
document.querySelector('[data-role="fixture-title"]')!.textContent='快捷键设置交互原型';
document.querySelector('[data-role="fixture-description"]')!.textContent='点击右下角设置入口重新打开。原型改动仅在当前页面生效，刷新后恢复默认。';
return () => { cancelRecord(false); composing=false; clearTimeout(toastTimer); lifetime.abort();headingObserver.disconnect(); tabs.remove();view.remove();footer.remove();toast.remove();style.remove(); };
}

let mountedHost: Element | null = null;
let pendingHost: Element | null = null;
let unmount: (()=>void) | null = null;
function syncMount(): void {
    if (mountedHost && (!mountedHost.isConnected || !mountedHost.shadowRoot?.querySelector('#prototype-keyboard-panel'))) { unmount?.(); unmount=null; mountedHost=null; }
    const next = document.getElementById('aimd-bookmarks-panel-host');
    if (!next || next===mountedHost || next===pendingHost) return;
    pendingHost=next;
    void waitForSettings().then(shadow=>{
        if(shadow.host!==next || !next.isConnected) return;
        mountedHost=next; unmount=mountPrototype(shadow);
    }).catch(error=>{if(next.isConnected)console.error(error);}).finally(()=>{if(pendingHost===next)pendingHost=null;});
}
new MutationObserver(syncMount).observe(document.documentElement,{childList:true,subtree:true});
syncMount();
