import { afterEach, describe, expect, it, vi } from 'vitest';
import { ButtonsSettingsView } from '@/ui/content/bookmarks/ui/tabs/ButtonsSettingsView';
import { DEFAULT_SETTINGS } from '@/core/settings/types';
import { planSetCategory } from '@/services/settings/settingsService';
const views: ButtonsSettingsView[] = [];
function fixture(save = vi.fn(async () => true)) {
    const view = new ButtonsSettingsView(save);
    views.push(view);
    document.body.append(view.root);
    view.setState(structuredClone(DEFAULT_SETTINGS));
    const shadow = view.root.shadowRoot!;
    const group = (name: string) => shadow.querySelector<HTMLButtonElement>(`[data-group="${name}"]`)!.click();
    const toggle = (path: string) => shadow.querySelector<HTMLButtonElement>(`[data-path="${path}"] [role="switch"]`)!;
    const pin = (id: string) => shadow.querySelector<HTMLButtonElement>(`[data-pin="${id}"]`)!;
    return { view, shadow, group, toggle, pin, save };
}
afterEach(() => {
    views.splice(0).forEach(view => {
        view.dispose();
        view.root.remove();
    });
});
describe('Buttons settings through its group and row controls', () => {
    it('keeps keyboard focus on the selected group while changing its content', () => {
        const f = fixture();
        const button = f.shadow.querySelector<HTMLButtonElement>('[data-group="Message"]')!;
        button.focus();
        button.click();
        expect(f.shadow.activeElement).toBe(button);
        expect(button.getAttribute('aria-pressed')).toBe('true');
    });
    it('preserves dormant pins and restores their collapsed preview when a button is enabled again', async () => {
        const f = fixture();
        f.pin('open-prompts').click();
        await vi.waitFor(() => expect(f.pin('open-prompts').getAttribute('aria-pressed')).toBe('true'));
        f.toggle('chatgptBehavior.showPromptControl').click();
        await vi.waitFor(() => expect(f.toggle('chatgptBehavior.showPromptControl').getAttribute('aria-checked')).toBe('false'));
        expect(f.pin('open-prompts').disabled).toBe(true);
        expect(f.pin('open-prompts').getAttribute('aria-pressed')).toBe('true');
        expect(f.shadow.querySelectorAll('.preview [data-action="open-prompts"]')).toHaveLength(0);
        f.toggle('chatgptBehavior.showPromptControl').click();
        await vi.waitFor(() => expect(f.pin('open-prompts').disabled).toBe(false));
        expect(f.shadow.querySelectorAll('.preview [data-action="open-prompts"]')).toHaveLength(2);
        expect(f.save).toHaveBeenNthCalledWith(1, 'chatgptBehavior', { pinnedPageControls: ['open-prompts'] });
    });
    it('does not change a preference until its write is acknowledged, and retains it on failure', async () => {
        let finish!: (value: boolean) => void;
        const save = vi.fn(() => new Promise<boolean>(resolve => {
            finish = resolve;
        }));
        const f = fixture(save);
        f.toggle('chatgptBehavior.showPromptControl').click();
        expect(f.toggle('chatgptBehavior.showPromptControl').getAttribute('aria-checked')).toBe('true');
        expect(f.toggle('chatgptBehavior.showPromptControl').disabled).toBe(true);
        finish(false);
        await vi.waitFor(() => expect(f.toggle('chatgptBehavior.showPromptControl').disabled).toBe(false));
        expect(f.toggle('chatgptBehavior.showPromptControl').getAttribute('aria-checked')).toBe('true');
        expect(f.shadow.querySelector('[role="status"]')!.textContent).toBeTruthy();
    });
    it('configures message pins and metadata independently and emits only the changed leaf', async () => {
        const f = fixture();
        f.group('Message');
        expect(f.pin('copy_prompt_reply')).toBeNull();
        f.pin('copy_markdown').click();
        await vi.waitFor(() => expect(f.pin('copy_markdown').getAttribute('aria-pressed')).toBe('true'));
        const previews = Array.from(f.shadow.querySelectorAll<HTMLElement>('.aimd-message-toolbar-host'));
        expect(previews).toHaveLength(2);
        expect(previews[0].shadowRoot!.querySelector('[data-action="copy_markdown"]')!.closest('[inert]')).toBeNull();
        expect(previews[0].shadowRoot!.querySelector('[data-action="copy_prompt_reply"]')).toBeNull();
        previews[0].shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!.focus();
        const lower = document.querySelector('.aimd-toolbar-hover-action-host')!.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_prompt_reply"]')!;
        expect(lower.querySelector('[data-glyph="promptReply"]')).toBeTruthy();
        expect(lower.closest<HTMLElement>('[data-role="toolbar-hover-actions"]')!.dataset.placement).toBe('bottom');
        f.toggle('behavior.showMessageTimestamp').click();
        await vi.waitFor(() => expect(f.toggle('behavior.showMessageTimestamp').getAttribute('aria-checked')).toBe('false'));
        for (const host of f.shadow.querySelectorAll<HTMLElement>('.aimd-message-toolbar-host')) {
            expect(host.shadowRoot!.querySelector('time')).toBeNull();
            expect(host.shadowRoot!.querySelector('[data-role="stats"]')).toBeTruthy();
        }
        expect(f.save).toHaveBeenLastCalledWith('behavior', { showMessageTimestamp: false });
        f.toggle('behavior.showMessageToolbar').click();
        await vi.waitFor(() => expect(f.pin('copy_markdown').disabled).toBe(true));
        expect(f.pin('copy_markdown').getAttribute('aria-pressed')).toBe('true');
    });
    it('preserves the separate reply and composer formula defaults', async () => {
        const f = fixture();
        f.group('Formula');
        expect(f.toggle('formula.assetActions.copyMathml').getAttribute('aria-checked')).toBe('false');
        Array.from(f.shadow.querySelectorAll<HTMLButtonElement>('.contexts button'))[1].click();
        expect(f.toggle('formula.composerAssetActions.copyMathml').getAttribute('aria-checked')).toBe('true');
        f.toggle('formula.composerAssetActions.copyMathml').click();
        await vi.waitFor(() => expect(f.toggle('formula.composerAssetActions.copyMathml').getAttribute('aria-checked')).toBe('false'));
        expect(f.save).toHaveBeenCalledWith('formula', { composerAssetActions: { copyMathml: false } });
        const next = planSetCategory(DEFAULT_SETTINGS, 'formula', { composerAssetActions: { copyMathml: false } }).next;
        expect(next.formula.composerAssetActions).toEqual({ copyPng: true, copySvg: true, copyMathml: false, savePng: true, saveSvg: true });
        expect(next.formula.assetActions).toEqual(DEFAULT_SETTINGS.formula.assetActions);
    });
    it('keeps copy hover options independent and preserves an old secondary pin without exposing it', async () => {
        const f = fixture();
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.behavior.pinnedMessageControls = ['copy_prompt_reply'];
        f.view.setState(settings);
        f.group('Message');
        expect(f.pin('copy_prompt_reply')).toBeNull();
        f.toggle('behavior.showCopyPng').click();
        await vi.waitFor(() => expect(f.toggle('behavior.showCopyPng').getAttribute('aria-checked')).toBe('false'));
        const toolbar = f.shadow.querySelectorAll<HTMLElement>('.aimd-message-toolbar-host')[1];
        toolbar.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="copy_markdown"]')!.focus();
        const portal = document.querySelector('.aimd-toolbar-hover-action-host')!.shadowRoot!;
        expect(portal.querySelector('[data-action="copy_png"]')).toBeNull();
        expect(portal.querySelector('[data-action="copy_prompt_reply"]')).toBeTruthy();
        f.toggle('behavior.messageControls.copy_markdown').click();
        await vi.waitFor(() => expect(f.toggle('behavior.messageControls.copy_prompt_reply').disabled).toBe(true));
        expect(f.toggle('behavior.messageControls.copy_prompt_reply').getAttribute('aria-checked')).toBe('true');
        expect(f.save).toHaveBeenLastCalledWith('behavior', { messageControls: { copy_markdown: false } });
    });
});
it('keeps controls read-only across group switches when Settings has no confirmed state', () => {
    const f = fixture();
    f.view.setReadOnly(true);
    f.group('Message');
    expect(f.toggle('behavior.showMessageToolbar').disabled).toBe(true);
    expect(f.pin('copy_markdown').disabled).toBe(true);
    f.toggle('behavior.showMessageToolbar').click();
    expect(f.save).not.toHaveBeenCalled();
    f.view.setReadOnly(false);
    expect(f.toggle('behavior.showMessageToolbar').disabled).toBe(false);
});

it('keeps Directory switches and removes the retired composer group',()=>{const f=fixture();f.group('Directory');expect(f.shadow.querySelector('[data-role="buttons-preview"]')).toBeNull();expect(f.shadow.querySelector('[role="switch"]')).toBeTruthy();expect(f.shadow.querySelector('[data-group="Composer"]')).toBeNull();});

it('uses the complete production formula window for the typing sample',async()=>{
 const asset={source:'E=mc^2',displayMode:false,fontSizePx:36,width:90,height:30,viewBox:'0 0 90 30',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 30"><path d="M0 0"/></svg>'};
 const view=new ButtonsSettingsView(async()=>true,async()=>asset);views.push(view);document.body.append(view.root);const shadow=view.root.shadowRoot!;shadow.querySelector<HTMLButtonElement>('[data-group="Formula"]')!.click();(shadow.querySelectorAll<HTMLButtonElement>('.contexts button')[1]).click();await vi.waitFor(()=>expect(shadow.querySelector('.formula-assistant .formula-preview svg')).toBeTruthy());expect(shadow.querySelector('.formula-preview-header')).toBeTruthy();expect(shadow.querySelectorAll('.formula-assistant .formula-export-actions button')).toHaveLength(5);expect(shadow.querySelector('.math-hover')).toBeNull();
});
