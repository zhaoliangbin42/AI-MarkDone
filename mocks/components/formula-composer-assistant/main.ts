import {
    installVisualHarnessBridge,
    isElementInViewport,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

const messages: Record<string, string> = {
    chatgptFormulaPreviewTitle: 'Formula preview',
    chatgptFormulaInlineKind: 'Inline $…$',
    chatgptFormulaDisplayKind: 'Display $$…$$',
    chatgptFormulaPreviewLoading: 'Rendering formula…',
    chatgptFormulaPreviewError: 'Preview unavailable for this formula',
};
const mockBrowserApi = {
    runtime: {
        id: 'aimd-formula-composer-assistant-mock',
        getURL: (path: string) => `/${path}`,
        getManifest: () => ({ manifest_version: 3 }),
    },
    i18n: { getMessage: (key: string) => messages[key] ?? key },
};
(globalThis as any).browser = mockBrowserApi;
Object.assign((globalThis as any).chrome ?? ((globalThis as any).chrome = {}), mockBrowserApi);

const [{ FormulaComposerAssistantPopover }, { setLocale }, { createAppearanceSnapshot }] = await Promise.all([
    import('../../../src/ui/content/components/FormulaComposerAssistantPopover'),
    import('../../../src/ui/content/components/i18n'),
    import('../../../src/style/appearance'),
]);
await setLocale('en');

const inlineSuggestions = [
    ['frac', '\\frac', '\\frac{${1:a}}{${2:b}}$0', 'Fraction', 'structure'],
    ['sqrt', '\\sqrt', '\\sqrt{${1:x}}$0', 'Square root', 'structure'],
    ['mathbf', '\\mathbf', '\\mathbf{${1:x}}$0', 'Bold math', 'structure'],
    ['varphi', '\\varphi', '\\varphi', 'Greek phi variant', 'greek'],
    ['rightarrow', '\\rightarrow', '\\rightarrow', 'Right arrow', 'arrow'],
    ['approx', '\\approx', '\\approx', 'Approximately equal', 'relation'],
    ['infty', '\\infty', '\\infty', 'Infinity', 'symbol'],
    ['partial', '\\partial', '\\partial', 'Partial derivative', 'symbol'],
    ['begin-aligned', '\\begin{aligned}', '\\begin{aligned}\n\t${1:formula}\n\\end{aligned}$0', 'Aligned formula environment', 'environment'],
    ['sum', '\\sum', '\\sum_{${1:i=1}}^{${2:n}}$0', 'Summation', 'operator'],
].map(([id, label, insertText, detail, category], index) => ({
    id,
    label,
    insertText,
    detail,
    category,
    priority: 100 - index,
}));

function readyAsset(source: string, displayMode: boolean) {
    return {
        source,
        displayMode,
        fontSizePx: 36,
        width: displayMode ? 360 : 160,
        height: displayMode ? 72 : 44,
        viewBox: displayMode ? '0 0 360 72' : '0 0 160 44',
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${displayMode ? '360 72' : '160 44'}"><text x="8" y="32" fill="#000000" font-family="serif" font-size="26">${displayMode ? 'Σᵢⁿ i = n(n+1)/2' : 'a / b'}</text></svg>`,
    };
}

const status = document.getElementById('status');
const instances: Array<{
    popover: InstanceType<typeof FormulaComposerAssistantPopover>;
    show: () => void;
    getAnchor: () => HTMLElement | null;
}> = [];
let visualVariant: VisualHarnessVariant = { theme: 'light', locale: 'en' };
let expectedOpenCount = 0;

function anchorRect(id: string): DOMRect {
    return document.getElementById(id)?.getBoundingClientRect() ?? new DOMRect(24, 24, 0, 20);
}

const inline = new FormulaComposerAssistantPopover({
    onSelect: (index: number) => {
        status!.textContent = `Selected ${inlineSuggestions[index]?.label ?? 'unknown'} without moving composer focus.`;
    },
});
const showInline = () => inline.show({
    anchorRect: anchorRect('inline-anchor'),
    mathKind: 'inline',
    preview: { status: 'ready', asset: readyAsset('\\frac{a}{b}', false) },
    suggestions: inlineSuggestions,
    selectedIndex: 0,
});
instances.push({
    popover: inline,
    show: showInline,
    getAnchor: () => document.getElementById('inline-anchor'),
});

const display = new FormulaComposerAssistantPopover({ onSelect: () => undefined });
let showingError = false;
const showSecondary = () => display.show(showingError ? {
    anchorRect: anchorRect('error-anchor'),
    mathKind: 'inline',
    preview: { status: 'error' },
    suggestions: [],
    selectedIndex: 0,
} : {
    anchorRect: anchorRect('display-anchor'),
    mathKind: 'display',
    preview: { status: 'ready', asset: readyAsset('\\sum_{i=1}^{n} i', true) },
    suggestions: [],
    selectedIndex: 0,
});
instances.push({
    popover: display,
    show: showSecondary,
    getAnchor: () => document.getElementById(showingError ? 'error-anchor' : 'display-anchor'),
});

async function prepareVisibleInstances(): Promise<void> {
    let visibleInstances = instances.filter(({ getAnchor }) => {
        const anchor = getAnchor();
        return anchor ? isElementInViewport(anchor) : false;
    });
    if (visibleInstances.length === 0) {
        instances[0]?.getAnchor()?.scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        visibleInstances = instances.slice(0, 1);
    }
    const visibleSet = new Set(visibleInstances);
    instances.forEach((instance) => {
        if (visibleSet.has(instance)) instance.show();
        else instance.popover.close();
    });
    expectedOpenCount = visibleInstances.length;
}

async function applyVisualVariant(variant: VisualHarnessVariant): Promise<void> {
    visualVariant = variant;
    document.documentElement.dataset.aimdTheme = variant.theme;
    document.documentElement.dataset.theme = variant.theme;
    document.body.dataset.theme = variant.theme;
    await setLocale(variant.locale);
    instances.forEach(({ popover }) => popover.setAppearance(createAppearanceSnapshot(variant.theme)));
}

requestAnimationFrame(() => {
    void prepareVisibleInstances();
    document.querySelector<HTMLInputElement>('.focus-probe')?.focus();
});

document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.aimdTheme !== 'dark';
    void applyVisualVariant({ ...visualVariant, theme: dark ? 'dark' : 'light' });
});

document.getElementById('error-toggle')?.addEventListener('click', (event) => {
    showingError = !showingError;
    (event.currentTarget as HTMLButtonElement).textContent = showingError ? 'Restore display preview' : 'Show real error state';
    showSecondary();
});

window.addEventListener('resize', () => void prepareVisibleInstances());

installVisualHarnessBridge({
    applyVariant: applyVisualVariant,
    prepareForAudit: prepareVisibleInstances,
    getState: () => ({
        ...visualVariant,
        expectedOpenSurfaces: [{ role: 'formula-composer-assistant', count: expectedOpenCount }],
        localeEvidence: instances
            .filter(({ popover }) => !popover.host.hidden)
            .map(({ popover }) => popover.host.shadowRoot?.textContent ?? '')
            .join(' '),
    }),
});
