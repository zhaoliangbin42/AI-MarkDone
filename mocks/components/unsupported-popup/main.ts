import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

const frame = document.getElementById('popup-frame') as HTMLIFrameElement;
let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

async function loadCatalog(locale: VisualHarnessVariant['locale']): Promise<Record<string, { message?: string }>> {
    const response = await fetch(`/_locales/${locale}/messages.json`);
    if (!response.ok) throw new Error(`Unable to load ${locale} popup catalog`);
    return await response.json() as Record<string, { message?: string }>;
}

async function renderPopup(next: VisualHarnessVariant): Promise<void> {
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.body.dataset.theme = next.theme;
    const [htmlResponse, catalog] = await Promise.all([
        fetch('/src/popup/popup.html'),
        loadCatalog(next.locale),
    ]);
    if (!htmlResponse.ok) throw new Error('Unable to load the shipped popup document');
    const popupHtml = await htmlResponse.text();
    const serializedCatalog = JSON.stringify(catalog).replaceAll('<', '\\u003c');
    const locale = next.locale === 'zh_CN' ? 'zh-CN' : 'en';
    const extensionApi = `<script>
      (() => {
        const catalog = ${serializedCatalog};
        const api = {
          runtime: { id: 'aimd-popup-visual', getURL: (path) => '/' + path.replace(/^\\//, '') },
          i18n: {
            getMessage: (key) => catalog[key]?.message || '',
            getUILanguage: () => ${JSON.stringify(locale)}
          },
          storage: { sync: { get: (_key, callback) => {
            const value = {};
            callback?.(value);
            return Promise.resolve(value);
          } } }
        };
        globalThis.browser = api;
        globalThis.chrome = api;
      })();
    <\/script>`;
    frame.srcdoc = popupHtml.replace('<script src="/src/popup/popup.js"></script>', `${extensionApi}<script src="/src/popup/popup.js"></script>`);
    await new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true }));
    const root = frame.contentDocument?.documentElement;
    if (root) {
        root.dataset.aimdTheme = next.theme;
        root.lang = locale;
    }
}

await renderPopup(variant);

installVisualHarnessBridge({
    applyVariant: renderPopup,
    prepareForAudit: () => frame.scrollIntoView({ block: 'start', inline: 'nearest' }),
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [],
        localeEvidence: frame.contentDocument?.body.innerText ?? '',
    }),
});
