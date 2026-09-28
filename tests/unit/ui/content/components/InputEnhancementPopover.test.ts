import { afterEach, expect, it, vi } from 'vitest';
import { InputEnhancementPopover } from '@/ui/content/components/InputEnhancementPopover';
import { DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS } from '@/core/settings/types';

afterEach(() => { document.body.replaceChildren(); });

it('preserves child preferences, rolls back failed writes, and stays open across the real pointer trigger', async () => {
    const save = vi.fn(async () => false);
    const popup = new InputEnhancementPopover(save);
    popup.updateSettings({ ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS, boldShortcut: false });
    const trigger = document.createElement('button'); document.body.append(trigger);
    trigger.addEventListener('click', () => popup.toggle(trigger));
    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); trigger.click();
    expect(popup.host.hidden).toBe(false);
    const master = popup.host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="chatgptInputEnhancementMasterLabel"]')!;
    master.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true })); master.click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, boldShortcut: false }));
    expect(popup.host.shadowRoot!.querySelector<HTMLInputElement>('[data-role="chatgptInputEnhancementMasterLabel"]')!.checked).toBe(true);
    expect(popup.host.hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    document.body.click();
    expect(popup.host.hidden).toBe(true);
    popup.dispose();
});
