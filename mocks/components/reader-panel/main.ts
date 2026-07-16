import '../browserExtensionMock';

import { bookOpenIcon } from '../../../src/assets/icons';
import { DEFAULT_SETTINGS } from '../../../src/core/settings/types';
import type { SiteAdapter } from '../../../src/drivers/content/adapters/base';
import type { ReaderItem } from '../../../src/services/reader/types';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import { ensurePageTokens } from '../../../src/style/pageTokens';
import { MessageToolbar } from '../../../src/ui/content/MessageToolbar';
import { setLocale, t } from '../../../src/ui/content/components/i18n';
import { ChatGPTMessageStepperController } from '../../../src/ui/content/controllers/ChatGPTMessageStepperController';
import { ReaderPanel } from '../../../src/ui/content/reader/ReaderPanel';
import { createConversationReaderActions } from '../../../src/ui/content/reader/conversationReaderActions';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

ensurePageTokens();
history.replaceState({}, '', '/c/12345678-abcd-4abc-8def-1234567890ab');

const readerItems: ReaderItem[] = [
    {
        id: 'reader-fixture-1',
        userPrompt: 'Summarize the principles behind a durable interface architecture.',
        content: [
            '# Durable interface architecture',
            '',
            'A resilient UI keeps **appearance**, lifecycle, and responsive geometry explicit while preserving the host application.',
            '',
            '## Core principles',
            '',
            '- One scroll owner per surface',
            '- Deterministic focus and Escape behavior',
            '- Tokenized spacing, color, radius, elevation, and motion',
            '',
            '> The surface should remain useful at narrow widths, short heights, long localized copy, and reduced motion.',
            '',
            '| Concern | Owner |',
            '| --- | --- |',
            '| Appearance | AppearanceSnapshot |',
            '| Lifecycle | SurfaceSession |',
            '| Geometry | Responsive profile |',
            '',
            '```ts',
            'const surface = { scrollOwner: "content", collision: "clamp" };',
            '```',
            '',
            '$$E = mc^2$$',
        ].join('\n'),
        meta: { position: 1, messageId: 'assistant-1', url: window.location.href },
    },
    {
        id: 'reader-fixture-2',
        userPrompt: 'How should the layout adapt under constrained viewports?',
        content: [
            '# Responsive contract',
            '',
            'At 900px the auxiliary outline yields to the reading flow. At 560px the Reader becomes a single-column viewport surface.',
            '',
            '## Short-height behavior',
            '',
            'The header and footer remain reachable while the central body owns vertical scrolling. Long Chinese and English copy must wrap without creating horizontal overflow.',
            '',
            '## Interaction states',
            '',
            'Keyboard focus, disabled controls, pending operations, comments, and settings all retain visible and predictable feedback.',
        ].join('\n'),
        meta: { position: 2, messageId: 'assistant-2', url: window.location.href },
    },
    {
        id: 'reader-fixture-3',
        userPrompt: 'List the final verification matrix.',
        content: [
            '# Verification matrix',
            '',
            'Validate 320, 390, 768, 1024, and 1440 pixel widths; 568 and 900 pixel heights; light and dark themes; English and Chinese; default and reduced motion.',
            '',
            '1. No horizontal overflow',
            '2. No clipped controls',
            '3. No competing body and surface scroll owners',
            '4. No focus or teardown leaks',
        ].join('\n'),
        meta: { position: 3, messageId: 'assistant-3', url: window.location.href },
    },
];

const browserApi = (globalThis as typeof globalThis & { browser: any }).browser;
browserApi.runtime.getURL = (path: string) => path.startsWith('vendor/katex/')
    ? `/node_modules/katex/dist/${path.slice('vendor/katex/'.length)}`
    : `/${path}`;
browserApi.runtime.sendMessage = async (request: { v: number; id: string; type: string }) => ({
    v: request.v,
    id: request.id,
    type: request.type,
    ok: true,
    data: request.type === 'bookmarks:changelogNotice:get'
        ? { pendingVersion: null, lastShownVersion: null, reason: null, previousVersion: null }
        : {},
});

const conversationRoot = document.querySelector<HTMLElement>('[data-role="conversation-root"]')!;
const user = conversationRoot.querySelector<HTMLElement>('.user-message')!;
const assistant = conversationRoot.querySelector<HTMLElement>('.assistant-message')!;
const content = conversationRoot.querySelector<HTMLElement>('.assistant-content')!;
const adapter = {
    matches: () => true,
    getPlatformId: () => 'chatgpt',
    getThemeDetector: () => ({
        detect: () => 'light' as const,
        getObserveTargets: () => [],
        hasExplicitTheme: () => true,
    }),
    extractUserPrompt: () => user.textContent,
    getMessageSelector: () => '.assistant-message',
    getMessageContentSelector: () => '.assistant-content',
    getActionBarSelector: () => '.official-actions',
    getToolbarAnchorElement: () => assistant.querySelector<HTMLElement>('.official-actions'),
    isStreamingMessage: () => false,
    getMessageId: () => 'assistant-1',
    getObserverContainer: () => conversationRoot,
    getConversationGroupRefs: () => [{
        id: 'turn-1',
        assistantRootEl: assistant,
        assistantMessageEl: assistant,
        assistantContentRootEl: content,
        userRootEl: user,
        userPromptText: user.textContent,
        userPromptQuality: 'real',
        barAnchorEl: user,
        groupEls: [user, assistant],
        assistantIndex: 0,
        isStreaming: false,
    }],
} as unknown as SiteAdapter;

const panel = new ReaderPanel();
let toolbar: MessageToolbar | null = null;
let stepper: ChatGPTMessageStepperController | null = null;
let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };
let lastTrigger: 'toolbar' | 'page-control' = 'toolbar';

const nextTask = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

function getReaderActions() {
    return createConversationReaderActions({
        locate: {
            locate: async () => ({ ok: true, message: variant.locale === 'zh_CN' ? '已定位到消息' : 'Located message' }),
        },
    });
}

async function showReader(trigger: 'toolbar' | 'page-control'): Promise<void> {
    lastTrigger = trigger;
    await panel.show(readerItems, 0, variant.theme, {
        profile: 'conversation-reader',
        actions: getReaderActions(),
    });
}

async function waitForReader(): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        const host = document.getElementById('aimd-reader-panel-host');
        if (host?.shadowRoot?.querySelector('.panel-window--reader')
            && host.shadowRoot.querySelector('.reader-markdown h1')) {
            return host;
        }
        await nextTask();
    }
    throw new Error('Reader fixture did not mount the production ReaderPanel.');
}

async function closeReader(): Promise<void> {
    const host = document.getElementById('aimd-reader-panel-host');
    if (!host) return;
    host.removeAttribute('data-aimd-role');
    panel.hide();
    host.shadowRoot?.querySelector<HTMLElement>('.panel-window--reader')
        ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    await nextTask();
}

function mountToolbar(): void {
    toolbar?.dispose();
    toolbar?.getElement().remove();
    toolbar = new MessageToolbar(variant.theme, [{
        id: 'reader',
        label: t('btnReader'),
        tooltip: t('btnReader'),
        icon: bookOpenIcon,
        kind: 'secondary',
        onClick: async () => showReader('toolbar'),
    }]);
    toolbar.setPlacement('actionbar');
    assistant.querySelector<HTMLElement>('.official-actions')!.replaceChildren(toolbar.getElement());
}

function mountPageControl(): void {
    stepper?.dispose();
    stepper = new ChatGPTMessageStepperController(adapter, {
        onOpenDetachedReader: () => showReader('page-control'),
        onTogglePageBookmark: () => ({ saved: false }),
        onRefreshPageBookmarkState: () => false,
    });
    stepper.init();
    stepper.setAppearance(createAppearanceSnapshot(variant.theme));
}

async function openFromProductionTrigger(usePageControl: boolean): Promise<HTMLElement> {
    const selector = usePageControl
        ? '[data-action="open-detached-reader"]'
        : '[data-action="reader"]';
    const button = usePageControl
        ? document.querySelector<HTMLButtonElement>(selector)
        : toolbar?.getElement().shadowRoot?.querySelector<HTMLButtonElement>(selector);
    if (!button) throw new Error(`Production Reader trigger is unavailable: ${selector}`);
    button.focus();
    button.click();
    const host = await waitForReader();
    host.setAttribute('data-aimd-role', 'reader-panel');
    return host;
}

async function applyVariant(next: VisualHarnessVariant): Promise<void> {
    await closeReader();
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.documentElement.lang = next.locale === 'zh_CN' ? 'zh-CN' : 'en';
    document.body.dataset.theme = next.theme;
    await setLocale(next.locale);

    const zh = next.locale === 'zh_CN';
    document.querySelector<HTMLElement>('[data-role="fixture-title"]')!.textContent = zh ? '阅读器面板入口' : 'Reader panel entry';
    document.querySelector<HTMLElement>('[data-role="fixture-description"]')!.textContent = zh
        ? '真实工具栏与页面控制按钮会打开生产环境中的阅读器。'
        : 'The production toolbar and page control open the production Reader panel.';

    panel.setAppearance(createAppearanceSnapshot(next.theme));
    panel.setReaderSettings({
        ...DEFAULT_SETTINGS.reader,
        defaultOpenMode: 'panel',
        showOutlineInReader: true,
    });
    mountToolbar();
    mountPageControl();
    await openFromProductionTrigger(next.theme === 'dark');
}

await applyVariant(variant);

installVisualHarnessBridge({
    applyVariant,
    prepareForAudit: async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    },
    getState: () => ({
        ...variant,
        expectedOpenSurfaces: [{ role: 'reader-panel', count: 1 }],
        localeEvidence: [
            lastTrigger,
            document.getElementById('aimd-reader-panel-host')?.shadowRoot?.textContent ?? '',
        ].join(' '),
    }),
});

window.addEventListener('pagehide', () => {
    toolbar?.dispose();
    stepper?.dispose();
    panel.hide();
}, { once: true });
