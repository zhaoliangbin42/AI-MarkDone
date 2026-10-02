import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageToolbar } from '@/ui/content/MessageToolbar';
import { setLocale } from '@/ui/content/components/i18n';

const mounted: MessageToolbar[] = [];
function mount(onClick = vi.fn(async () => ({ ok: true as const })), pinnedActions: readonly string[] = []) {
    const toolbar = new MessageToolbar('light', [{ id: 'copy', label: 'Copy', icon: '<svg/>', onClick }], { collapsible: true, showStats: true, pinnedActions });
    mounted.push(toolbar); document.body.append(toolbar.getElement());
    const shadow = toolbar.getElement().shadowRoot!;
    return { toolbar, shadow, toggle: shadow.querySelector<HTMLButtonElement>('[data-action="toggle-capsule"]')!, action: shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')! };
}
afterEach(() => { mounted.splice(0).forEach(toolbar => { toolbar.dispose(); toolbar.getElement().remove(); }); vi.useRealTimers(); });

describe('message capsule entry', () => {
    it('opens on hover and closes after the pointer leaves without requiring a click', async () => {
        const { shadow, toggle } = mount();
        const bar = shadow.querySelector<HTMLElement>('.bar')!;
        const drawer = shadow.querySelector<HTMLElement>('.capsule-actions')!;

        bar.dispatchEvent(new MouseEvent('mouseenter'));
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toggle.dispatchEvent(new MouseEvent('mouseenter'));
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(drawer.hasAttribute('inert')).toBe(false);

        bar.dispatchEvent(new MouseEvent('mouseleave'));
        await vi.waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'));
        expect(drawer.hasAttribute('inert')).toBe(true);
    });

    it('opens existing actions through its toggle and closes on Escape with focus restored', async () => {
        const click = vi.fn(async () => ({ ok: true as const }));
        const { shadow, toggle, action, toolbar } = mount(click);
        const drawer = shadow.querySelector<HTMLElement>('.capsule-actions')!;
        expect(drawer.inert).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toolbar.setStats(['128 Chars']);
        toggle.click();
        expect(drawer.hasAttribute('inert')).toBe(false);
        action.click(); await Promise.resolve();
        expect(click).toHaveBeenCalledOnce();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(drawer.hasAttribute('inert')).toBe(true);
        expect(shadow.activeElement).toBe(toggle);
        expect(shadow.querySelector('[data-role="stats"]')?.textContent).toBe('128 Chars');
    });

    it('keeps an active operation alive when collapsed and preserves an explicit disabled state', async () => {
        let complete!: (value: {ok: true}) => void;
        const click = vi.fn(() => new Promise<{ok: true}>(resolve => { complete = resolve; }));
        const { toolbar, toggle, action } = mount(click);
        toggle.click(); action.click();
        document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toolbar.setActionDisabled('copy', true);
        complete({ok: true}); await Promise.resolve(); await Promise.resolve();
        toggle.click();
        expect(action.disabled).toBe(true);
        expect(click).toHaveBeenCalledOnce();
    });

    it('prefers website update time and omits unavailable time independently of statistics', () => {
        const { toolbar, shadow } = mount();
        const time = shadow.querySelector<HTMLTimeElement>('time')!;
        expect(time.hidden).toBe(true);
        toolbar.setMessageMetadata({ createdAt: 1700000000000, updatedAt: 1700000060000 });
        expect(time.hidden).toBe(false);
        expect(time.dateTime).toBe(new Date(1700000060000).toISOString());
        expect(time.textContent).not.toContain('2023');
        expect(time.textContent).toContain(' ');
        toolbar.setMessageMetadata({createdAt: 1700000000000});
        expect(time.dateTime).toBe(new Date(1700000000000).toISOString());
        toolbar.setMessageMetadata(null);
        expect(time.hidden).toBe(true);
        expect(time.textContent).toBe('');
    });

    it('formats message time with the selected Chinese or English interface language', async () => {
        const timestamp = new Date(2024, 10, 14, 9, 6).getTime();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
        const formatDate = vi.spyOn(Date.prototype, 'toLocaleDateString');
        const formatTime = vi.spyOn(Date.prototype, 'toLocaleTimeString');
        try {
            for (const [language, intlLocale] of [['zh_CN', 'zh-CN'], ['en', 'en-US']] as const) {
                await setLocale(language);
                const date = new Date(timestamp);
                const expected = `${date.toLocaleDateString(intlLocale, { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                formatDate.mockClear(); formatTime.mockClear();
                const { toolbar, shadow } = mount();
                toolbar.setMessageMetadata({ createdAt: timestamp });
                expect(shadow.querySelector('time')?.textContent).toBe(expected);
                expect(formatDate).toHaveBeenCalledWith(intlLocale, { month: '2-digit', day: '2-digit' });
                expect(formatTime).toHaveBeenCalledWith(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
            }
        } finally {
            await setLocale('auto');
            vi.unstubAllGlobals();
            formatDate.mockRestore(); formatTime.mockRestore();
        }
    });
});

describe('message action pins', () => {
    it('keeps pinned hover and focus independent while preserving its tooltip and click action', async () => {
        vi.useFakeTimers();
        const onClick = vi.fn(async () => ({ ok: true as const }));
        const { shadow, toggle, action } = mount(onClick, ['copy']);
        const bar = shadow.querySelector<HTMLElement>('.bar')!;
        const drawer = shadow.querySelector<HTMLElement>('.capsule-actions')!;
        vi.spyOn(action, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 100, left: 100, top: 100, width: 24, height: 24, right: 124, bottom: 124, toJSON: () => ({}) } as DOMRect);

        bar.dispatchEvent(new MouseEvent('mouseenter'));
        action.dispatchEvent(new Event('pointerover', { bubbles: true, composed: true }));
        action.dispatchEvent(new MouseEvent('mouseenter'));
        action.focus();
        await vi.advanceTimersByTimeAsync(150);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(drawer.inert).toBe(true);
        expect(action.closest('.capsule-pinned')).toBeTruthy();
        expect(document.querySelector('.aimd-tooltip')?.textContent).toBe('Copy');

        action.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
        action.click();
        await Promise.resolve();
        expect(onClick).toHaveBeenCalledOnce();
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        toggle.dispatchEvent(new MouseEvent('mouseenter'));
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(shadow.querySelectorAll('[data-action="copy"]')).toHaveLength(1);
    });

    it('uses the same pinned button once in collapsed and expanded states and keeps it clickable outside the inert drawer', async () => {
        const onClick=vi.fn(async()=>undefined);
        const toolbar=new MessageToolbar('light',[{id:'copy',label:'Copy',icon:'<svg/>',onClick},{id:'reader',label:'Reader',icon:'<svg/>',onClick:async()=>undefined}],{collapsible:true,pinnedActions:['copy'],showStats:true,showTimestamp:false});
        mounted.push(toolbar);document.body.append(toolbar.getElement());const shadow=toolbar.getElement().shadowRoot!;
        const button=shadow.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
        expect(button.closest('[inert]')).toBeNull();expect(button.closest('.capsule-pinned')).toBeTruthy();expect(shadow.querySelector('time')).toBeNull();
        button.click();await Promise.resolve();expect(onClick).toHaveBeenCalledOnce();
        shadow.querySelector<HTMLButtonElement>('[data-action="toggle-capsule"]')!.click();expect(button.closest('.capsule-actions')).toBeTruthy();expect(shadow.querySelectorAll('[data-action="copy"]')).toHaveLength(1);
        window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));expect(button.closest('.capsule-pinned')).toBeTruthy();expect(button.closest('[inert]')).toBeNull();
    });
});
