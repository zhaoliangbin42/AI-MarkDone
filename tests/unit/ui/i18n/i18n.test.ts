import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readLocaleJson(locale: 'en' | 'zh_CN'): any {
    const filePath = path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('i18n', () => {
    it('loads a catalog via fetch and applies substitutions', async () => {
        vi.resetModules();

        const zh = readLocaleJson('zh_CN');
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: any) => {
                if (String(url).includes('_locales/zh_CN/messages.json')) {
                    return { ok: true, json: async () => zh } as any;
                }
                return { ok: false, json: async () => ({}) } as any;
            }),
        );

        const { getEffectiveLocale, setLocale, t } = await import('@/ui/content/components/i18n');
        await setLocale('zh_CN');

        expect(getEffectiveLocale()).toBe('zh_CN');
        expect(t('btnClose')).toBe('关闭');
        expect(t('goToPage', '3')).toBe('跳转到 3');
    });

    it('falls back to XHR when fetch fails', async () => {
        vi.resetModules();

        const en = readLocaleJson('en');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('fetch blocked');
            }),
        );

        class MockXhr {
            public status = 200;
            public responseType: string = '';
            public response: any = null;
            public onload: null | (() => void) = null;
            public onerror: null | (() => void) = null;
            open() {}
            send() {
                this.response = en;
                this.onload?.();
            }
        }

        (globalThis as any).XMLHttpRequest = MockXhr as any;

        const { getEffectiveLocale, setLocale, t } = await import('@/ui/content/components/i18n');
        await setLocale('en');

        expect(getEffectiveLocale()).toBe('en');
        expect(t('btnClose')).toBe('Close');
    });

    it('auto locale resolves to zh_CN for zh languages and notifies subscribers', async () => {
        vi.resetModules();

        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: any) => {
                const target = String(url);
                if (target.includes('_locales/zh_CN/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('zh_CN') } as any;
                }
                if (target.includes('_locales/en/messages.json')) {
                    return { ok: true, json: async () => readLocaleJson('en') } as any;
                }
                return { ok: false, json: async () => ({}) } as any;
            }),
        );

        Object.defineProperty(globalThis.navigator, 'language', {
            value: 'zh-CN',
            configurable: true,
        });

        const { getEffectiveLocale, setLocale, subscribeLocaleChange, t } = await import(
            '@/ui/content/components/i18n'
        );
        const seen: string[] = [];
        const unsub = subscribeLocaleChange((locale) => seen.push(locale));

        await setLocale('auto');

        expect(getEffectiveLocale()).toBe('zh_CN');
        expect(t('send')).toBe('发送');
        expect(seen).toEqual(['auto']);

        unsub();
    });
});

