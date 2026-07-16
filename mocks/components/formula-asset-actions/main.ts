import {
    installVisualHarnessBridge,
    isElementInViewport,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

type Locale = VisualHarnessVariant['locale'];

const localized = {
    en: {
        formulaCopyAsSvg: 'Copy as SVG',
        formulaCopyAsMathml: 'Copy as MathML',
        formulaSaveAsSvg: 'Save as SVG',
        formulaAssetRendering: 'Rendering…',
        formulaAssetSaved: 'Saved',
        btnCopied: 'Copied',
        title: 'Formula asset actions',
        description: 'Hover the rendered formula to open the production asset-action portal.',
        caseTitle: 'Settings-driven hover actions',
        caseDescription: 'The enabled formats below are passed through the real controller settings path.',
        copySvg: 'Copy SVG',
        copyMathml: 'Copy MathML',
        saveSvg: 'Save SVG',
        ready: 'Hover actions are ready.',
    },
    zh_CN: {
        formulaCopyAsSvg: '复制为 SVG',
        formulaCopyAsMathml: '复制为 MathML',
        formulaSaveAsSvg: '保存为 SVG',
        formulaAssetRendering: '正在渲染…',
        formulaAssetSaved: '已保存',
        btnCopied: '已复制',
        title: '公式资产操作',
        description: '悬停在已渲染的公式上，打开真实的资产操作浮层。',
        caseTitle: '由设置驱动的悬停操作',
        caseDescription: '下方已启用的格式会通过真实 controller 的设置链路传入。',
        copySvg: '复制 SVG',
        copyMathml: '复制 MathML',
        saveSvg: '保存 SVG',
        ready: '悬停操作已就绪。',
    },
} as const;

let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };
let locale: Locale = 'en';

const runtime = {
    id: 'aimd-formula-asset-actions-mock',
    getURL: (path: string) => `/${path}`,
    getManifest: () => ({ manifest_version: 3 }),
    sendMessage: async () => undefined,
};
const mockBrowserApi = {
    runtime,
    i18n: {
        getMessage: (key: string) => localized[locale][key as keyof typeof localized.en] ?? key,
    },
};
(globalThis as any).browser = mockBrowserApi;
Object.assign((globalThis as any).chrome ?? ((globalThis as any).chrome = {}), mockBrowserApi);

const [{ FormulaAssetHoverController }, { createAppearanceSnapshot }] = await Promise.all([
    import('../../../src/ui/content/controllers/FormulaAssetHoverController'),
    import('../../../src/style/appearance'),
]);

const container = document.getElementById('formula-container') as HTMLElement;
const target = document.getElementById('formula-target') as HTMLElement;
const copySvg = document.getElementById('copy-svg') as HTMLInputElement;
const copyMathml = document.getElementById('copy-mathml') as HTMLInputElement;
const saveSvg = document.getElementById('save-svg') as HTMLInputElement;
const controller = new FormulaAssetHoverController({
    runFormulaAssetAction: async ({ action }) => ({
        ok: true,
        status: action.startsWith('save_') ? 'saved' : 'copied',
    }),
});

function setFormulaSettings(): void {
    controller.setFormulaSettings({
        clickCopyMarkdown: false,
        clickCopyFormulaFormat: 'markdown-dollar',
        markdownCopyFormulaFormat: 'markdown-dollar',
        assetFontSizePx: 40,
        assetActions: {
            copyPng: false,
            copySvg: copySvg.checked,
            copyMathml: copyMathml.checked,
            savePng: false,
            saveSvg: saveSvg.checked,
        },
    });
}

controller.enable(container);
setFormulaSettings();
[copySvg, copyMathml, saveSvg].forEach((input) => input.addEventListener('change', setFormulaSettings));

function applyCopy(next: VisualHarnessVariant): void {
    const copy = localized[next.locale];
    document.querySelector<HTMLElement>('[data-role="fixture-title"]')!.textContent = copy.title;
    document.querySelector<HTMLElement>('[data-role="fixture-description"]')!.textContent = copy.description;
    document.querySelector<HTMLElement>('[data-role="case-title"]')!.textContent = copy.caseTitle;
    document.querySelector<HTMLElement>('[data-role="case-description"]')!.textContent = copy.caseDescription;
    document.querySelector<HTMLElement>('[data-role="copy-svg-label"]')!.textContent = copy.copySvg;
    document.querySelector<HTMLElement>('[data-role="copy-mathml-label"]')!.textContent = copy.copyMathml;
    document.querySelector<HTMLElement>('[data-role="save-svg-label"]')!.textContent = copy.saveSvg;
    document.getElementById('fixture-status')!.textContent = copy.ready;
}

async function applyVariant(next: VisualHarnessVariant): Promise<void> {
    variant = next;
    locale = next.locale;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.body.dataset.theme = next.theme;
    controller.setAppearance(createAppearanceSnapshot(next.theme));
    applyCopy(next);
}

function nextAnimationFrame(): Promise<void> {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function ensureTargetReadyForHover(): Promise<void> {
    if (isElementInViewport(target)) return;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    await nextAnimationFrame();
}

async function prepareForAudit(): Promise<void> {
    copySvg.checked = true;
    copyMathml.checked = true;
    saveSvg.checked = true;
    setFormulaSettings();
    await ensureTargetReadyForHover();
    target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await new Promise((resolve) => window.setTimeout(resolve, 130));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

installVisualHarnessBridge({
    applyVariant,
    prepareForAudit,
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [{ role: 'toolbar-hover-actions', count: 1 }],
        localeEvidence: [
            document.querySelector('[data-role="fixture-title"]')?.textContent ?? '',
            document.querySelector('.aimd-toolbar-hover-action-host')?.shadowRoot?.textContent ?? '',
        ].join(' '),
    }),
});

await applyVariant(variant);
await prepareForAudit();

window.addEventListener('pagehide', () => controller.disable(), { once: true });
