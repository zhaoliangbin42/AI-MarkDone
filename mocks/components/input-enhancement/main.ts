import { ensurePageTokens } from '../../../src/style/pageTokens';
import {
    installVisualHarnessBridge,
    isElementInViewport,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

const mockBrowserApi = {
    runtime: {
        id: 'aimd-input-enhancement-mock',
        getURL: (path: string) => `/${path}`,
        getManifest: () => ({ manifest_version: 3 }),
    },
    i18n: { getMessage: (key: string) => key },
};
(globalThis as any).browser = mockBrowserApi;
Object.assign((globalThis as any).chrome ?? ((globalThis as any).chrome = {}), mockBrowserApi);

const [{ DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS }, { setLocale }, { createAppearanceSnapshot }, { InputEnhancementButton }, { InputEnhancementPopover }] = await Promise.all([
    import('../../../src/core/settings/types'),
    import('../../../src/ui/content/components/i18n'),
    import('../../../src/style/appearance'),
    import('../../../src/ui/content/components/InputEnhancementButton'),
    import('../../../src/ui/content/components/InputEnhancementPopover'),
]);

ensurePageTokens();
await setLocale('en');

type Settings = typeof DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS;
type MountedCase = {
    button: InstanceType<typeof InputEnhancementButton>;
    popover: InstanceType<typeof InputEnhancementPopover>;
    settings: Settings;
    open: boolean;
    shouldOpen: boolean;
    pending: boolean;
};

const stage = document.getElementById('stage')!;
const mounted: MountedCase[] = [];
let visualVariant: VisualHarnessVariant = { theme: 'light', locale: 'en' };
let expectedOpenCount = 0;

function mountCase(params: {
    title: string;
    description: string;
    draft: string;
    settings: Settings;
    open?: boolean;
    pending?: boolean;
}): void {
    const article = document.createElement('article');
    article.className = 'case';
    article.innerHTML = `
      <div><h2></h2><p></p></div>
      <div class="composer">
        <div class="draft"></div>
        <div class="actions"><button class="plus" type="button" aria-label="Attach">+</button></div>
      </div>
    `;
    article.querySelector('h2')!.textContent = params.title;
    article.querySelector('p')!.textContent = params.description;
    article.querySelector<HTMLElement>('.draft')!.textContent = params.draft;
    stage.appendChild(article);

    const anchorRow = article.querySelector<HTMLElement>('.actions')!;
    let settings = structuredClone(params.settings);
    const popover = new InputEnhancementPopover({
        onChange: (next: Settings) => {
            settings = structuredClone(next);
            state.settings = settings;
            button.setEnabled(settings.available && settings.enabled);
            window.setTimeout(() => popover.update(settings, state.pending), 450);
        },
        onClose: () => {
            state.open = false;
            button.setExpanded(false);
        },
        onOpenGuide: () => undefined,
    });
    const button = new InputEnhancementButton({
        onOpen: () => {
            if (state.open) {
                popover.close('programmatic');
                return;
            }
            state.open = true;
            button.setExpanded(true);
            popover.open({ anchor: button.getAnchorElement(), settings, pending: state.pending });
        },
    });
    const state: MountedCase = {
        button,
        popover,
        settings,
        open: Boolean(params.open),
        shouldOpen: Boolean(params.open),
        pending: Boolean(params.pending),
    };
    mounted.push(state);
    button.setEnabled(settings.available && settings.enabled);
    button.setPending(state.pending);
    anchorRow.appendChild(button.host);

    if (state.open) {
        button.setExpanded(true);
        popover.open({ anchor: button.getAnchorElement(), settings, pending: state.pending });
    }
}

function setCaseOpen(state: MountedCase, open: boolean): void {
    if (open === state.open) return;
    state.open = open;
    state.button.setExpanded(open);
    if (open) {
        state.popover.open({
            anchor: state.button.getAnchorElement(),
            settings: state.settings,
            pending: state.pending,
        });
    } else {
        state.popover.close('programmatic');
    }
}

async function prepareVisibleCases(): Promise<void> {
    const requested = mounted.filter((state) => state.shouldOpen);
    let visible = requested.filter((state) => isElementInViewport(state.button.getAnchorElement()));
    if (visible.length === 0 && requested[0]) {
        requested[0].button.getAnchorElement().scrollIntoView({ block: 'center', inline: 'nearest' });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        visible = requested.filter((state) => isElementInViewport(state.button.getAnchorElement()));
    }
    const visibleSet = new Set(visible);
    requested.forEach((state) => setCaseOpen(state, visibleSet.has(state)));
    expectedOpenCount = visible.length;
    window.dispatchEvent(new Event('resize'));
}

async function applyVisualVariant(variant: VisualHarnessVariant): Promise<void> {
    visualVariant = variant;
    document.documentElement.dataset.aimdTheme = variant.theme;
    document.documentElement.dataset.theme = variant.theme;
    document.body.dataset.theme = variant.theme;
    mounted.forEach(({ popover }) => popover.setAppearance(createAppearanceSnapshot(variant.theme)));
    await setLocale(variant.locale);
}

mountCase({
    title: 'Enabled and open',
    description: 'Every capability is active; changing a switch simulates an asynchronous save.',
    draft: '1. First item\n2. Second item\n\nExplain $\\fra$',
    settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
    open: true,
});
mountCase({
    title: 'Master paused',
    description: 'Child choices remain checked and visible, but cannot be changed until resumed.',
    draft: '**Visible markers** remain in the official composer.',
    settings: { ...structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS), enabled: false },
    open: true,
});
mountCase({
    title: 'List master off',
    description: 'Only ordered and unordered list switches are disabled; other features stay available.',
    draft: '- List automation paused\nPlain Enter still inserts a line.',
    settings: {
        ...structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
        lists: { enabled: false, ordered: true, unordered: true },
    },
});
mountCase({
    title: 'Persistence pending',
    description: 'Button and controls expose busy state without changing the saved snapshot.',
    draft: '$$\\sum_{i=1}^{n} i$$',
    settings: structuredClone(DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS),
    pending: true,
});

document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const dark = document.documentElement.dataset.aimdTheme !== 'dark';
    void applyVisualVariant({ ...visualVariant, theme: dark ? 'dark' : 'light' });
});

document.getElementById('locale-toggle')?.addEventListener('click', async () => {
    await applyVisualVariant({
        ...visualVariant,
        locale: visualVariant.locale === 'en' ? 'zh_CN' : 'en',
    });
});

document.getElementById('width-toggle')?.addEventListener('click', () => {
    stage.dataset.narrow = stage.dataset.narrow === '1' ? '0' : '1';
    window.dispatchEvent(new Event('resize'));
});

installVisualHarnessBridge({
    applyVariant: applyVisualVariant,
    prepareForAudit: prepareVisibleCases,
    getState: () => ({
        ...visualVariant,
        expectedOpenSurfaces: [{ role: 'input-enhancement-popover', count: expectedOpenCount }],
        localeEvidence: mounted
            .filter(({ open }) => open)
            .map(({ popover }) => popover.host.shadowRoot?.textContent ?? '')
            .join(' '),
    }),
});
