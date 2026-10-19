import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTShortcutController } from '@/ui/content/shortcuts/ChatGPTShortcutController';
import { getDefaultShortcutBindings, normalizeShortcutSettings, type ShortcutCommandId, type ShortcutSettings } from '@/core/shortcuts';
import { attachDialogKeyboardScope, DIALOG_KEYBOARD_SCOPE_ATTRIBUTE, getTopDialogKeyboardScopeRoot } from '@/ui/content/components/dialogKeyboardScope';
import { isShortcutEventEligible } from '@/ui/content/shortcuts/shortcutEventScope';

const controllers: ChatGPTShortcutController[] = [];
const scopes: Array<{detach():void}> = [];
afterEach(()=>{controllers.splice(0).forEach(c=>c.dispose());scopes.splice(0).forEach(s=>s.detach());document.body.replaceChildren();vi.restoreAllMocks();});
function setup(settings: ShortcutSettings = normalizeShortcutSettings(undefined)) {
    vi.spyOn(navigator,'platform','get').mockReturnValue('Win32');
    const actions = {
        copy: vi.fn(()=>true), selection: vi.fn(()=>true), navigate: vi.fn(()=>true),
        prompts: {canOpenSuggestions:vi.fn((e?:KeyboardEvent)=>e?.composedPath().some(n=>n instanceof HTMLTextAreaElement)??false),openSuggestions:vi.fn(async()=>true),openManager:vi.fn(async()=>undefined)},
    };
    const controller=new ChatGPTShortcutController(actions); controllers.push(controller); controller.setSettings(settings);controller.setActive(true);controller.init();
    return {controller,actions};
}
function press(code:string,target:EventTarget=document.body,extra:KeyboardEventInit={}) {
    const event=new KeyboardEvent('keydown',{key:code.startsWith('Digit')?'!':code,code,ctrlKey:true,shiftKey:true,bubbles:true,composed:true,cancelable:true,...extra});target.dispatchEvent(event);return event;
}
function pressDefault(id: ShortcutCommandId, target: EventTarget = document.body, extra: KeyboardEventInit = {}) {
    const binding = getDefaultShortcutBindings()[id]!;
    return press(binding.code, target, { ctrlKey: binding.primary || binding.control === true, shiftKey: binding.shift, altKey: binding.alt, ...extra });
}
describe('ChatGPT shortcut user trigger',()=>{
    it.each(['selection.highlight.blue','selection.highlight.yellow','selection.highlight.red','selection.highlight','selection.annotate'] as const)('routes the current default for %s', id=>{
        const {actions}=setup();expect(pressDefault(id).defaultPrevented).toBe(true);expect(actions.selection).toHaveBeenCalledExactlyOnceWith(id);
    });
    it('keeps platform copy on the existing clipboard owner without forcing native-copy cancellation',()=>{
        const {actions}=setup(normalizeShortcutSettings({enabled:true,overrides:{'selection.copyMarkdown':{code:'KeyC',primary:true,shift:false,alt:false}},disabled:[]}));
        const event=press('KeyC',document.body,{key:'c',shiftKey:false});expect(actions.copy).toHaveBeenCalledWith(event);expect(event.defaultPrevented).toBe(false);
    });
    it('leaves unavailable selection and unrelated native keys alone',()=>{
        const {actions}=setup();actions.selection.mockReturnValue(false);expect(pressDefault('selection.highlight.blue').defaultPrevented).toBe(false);expect(press('KeyA').defaultPrevented).toBe(false);
    });
    it('does not act inside editable fields, IME or key repeats',()=>{
        const {actions}=setup();const input=document.createElement('textarea');document.body.append(input);
        pressDefault('selection.highlight.blue',input);pressDefault('selection.highlight.blue',document.body,{isComposing:true});pressDefault('selection.highlight.blue',document.body,{repeat:true});
        const legacy= new KeyboardEvent('keydown',{code:'KeyB',key:'B',ctrlKey:false,shiftKey:true,bubbles:true});Object.defineProperty(legacy,'keyCode',{value:229});document.body.dispatchEvent(legacy);
        expect(actions.selection).not.toHaveBeenCalled();
    });
    it('allows a composer-specific binding to share a selection chord and invokes only the composer command',()=>{
        const config=normalizeShortcutSettings({enabled:true,overrides:{'selection.highlight.blue':{code:'Digit1',primary:true,shift:true,alt:false},'prompts.openSuggestions':{code:'Digit1',primary:true,shift:true,alt:false}},disabled:[]});
        const {actions}=setup(config);const input=document.createElement('textarea');document.body.append(input);
        expect(press('Digit1',input).defaultPrevented).toBe(true);expect(actions.prompts.openSuggestions).toHaveBeenCalledOnce();expect(actions.selection).not.toHaveBeenCalled();
    });
    it('ignores keyboard recording through nested Shadow DOM',()=>{
        const {actions}=setup();const host=document.createElement('div');host.setAttribute('data-aimd-shortcut-recording','true');const shadow=host.attachShadow({mode:'open'});const input=document.createElement('div');shadow.append(input);document.body.append(host);
        pressDefault('selection.highlight.blue',input);expect(actions.selection).not.toHaveBeenCalled();
    });
    it('opens prompts for the page Reader registered composer across the lazy module scope',()=>{
        const {actions}=setup();const reader=document.createElement('div');reader.id='aimd-reader-panel-host';reader.setAttribute(DIALOG_KEYBOARD_SCOPE_ATTRIBUTE,'lazy-reader');const shadow=reader.attachShadow({mode:'open'});const input=document.createElement('textarea');shadow.append(input);document.body.append(reader);input.focus();
        expect(pressDefault('prompts.openSuggestions',input).defaultPrevented).toBe(true);expect(actions.prompts.openSuggestions).toHaveBeenCalledOnce();
    });
    it('yields the composer shortcut when the host declares the same access key',()=>{
        const {actions}=setup();
        const input=document.createElement('textarea');
        const hostAction=document.createElement('button');hostAction.accessKey='x P';
        document.body.append(input,hostAction);
        expect(pressDefault('prompts.openSuggestions',input,{key:'P'}).defaultPrevented).toBe(false);
        expect(actions.prompts.openSuggestions).not.toHaveBeenCalled();
    });
    it('keeps composer suggestions available when a different host access key exists',()=>{
        const {actions}=setup();
        const input=document.createElement('textarea');
        const hostAction=document.createElement('button');hostAction.accessKey='q';
        document.body.append(input,hostAction);
        expect(pressDefault('prompts.openSuggestions',input,{key:'P'}).defaultPrevented).toBe(true);
        expect(actions.prompts.openSuggestions).toHaveBeenCalledOnce();
    });
    it('honors a lazy UI scope marker even when the local module stack has no entry',()=>{
        const {actions}=setup();const foreign=document.createElement('div');foreign.setAttribute(DIALOG_KEYBOARD_SCOPE_ATTRIBUTE,'foreign-lazy-graph');document.body.append(foreign);
        expect(getTopDialogKeyboardScopeRoot()).toBe(null);pressDefault('selection.highlight.blue');expect(actions.selection).not.toHaveBeenCalled();
    });
    it('allows Reader-owned events but pauses them under a nested dialog',()=>{
        const owner=document.createElement('div');document.body.append(owner);scopes.push(attachDialogKeyboardScope({root:owner,onEscape:()=>{},maintainFocus:false}));
        let allowed=false;owner.addEventListener('keydown',e=>{allowed=isShortcutEventEligible(e,{owner});},true);
        press('Digit1',owner);expect(allowed).toBe(true);
        const nested=document.createElement('div');document.body.append(nested);scopes.push(attachDialogKeyboardScope({root:nested,onEscape:()=>{},maintainFocus:false}));press('Digit1',owner);expect(allowed).toBe(false);
    });
    it('updates bindings and global enablement without accumulating listeners',()=>{
        const {controller,actions}=setup();controller.init();controller.setSettings(normalizeShortcutSettings({enabled:true,overrides:{'selection.annotate':{code:'Digit7',primary:true,shift:true,alt:false}},disabled:[]}));
        pressDefault('selection.annotate');expect(actions.selection).not.toHaveBeenCalled();press('Digit7');expect(actions.selection).toHaveBeenCalledExactlyOnceWith('selection.annotate');
        controller.setSettings({...normalizeShortcutSettings(undefined),enabled:false});pressDefault('selection.highlight.blue');expect(actions.selection).toHaveBeenCalledTimes(1);controller.setActive(false);pressDefault('selection.highlight.blue');expect(actions.selection).toHaveBeenCalledTimes(1);
    });
});
