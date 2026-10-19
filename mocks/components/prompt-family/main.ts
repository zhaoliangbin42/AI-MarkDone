import '../browserExtensionMock';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

const [
    { ChatGPTPromptAutocompleteController },
    { createAppearanceSnapshot },
    { setLocale },
    { ChatGPTShortcutController },
] = await Promise.all([
    import('../../../src/ui/content/controllers/ChatGPTPromptAutocompleteController'),
    import('../../../src/style/appearance'),
    import('../../../src/ui/content/components/i18n'),
    import('../../../src/ui/content/shortcuts/ChatGPTShortcutController'),
]);

const composer = document.getElementById('composer') as HTMLTextAreaElement;
const managerTrigger = document.getElementById('manager-trigger') as HTMLButtonElement;
const localeStatus = document.getElementById('locale-status') as HTMLSpanElement;
const params = new URLSearchParams(location.search);
const automaticToggle = document.getElementById('automatic-toggle') as HTMLInputElement;
automaticToggle.checked = params.get('automatic') !== 'off';
const prompts = [
    { id: 'rewrite', title: 'Rewrite clearly', content: 'Rewrite this clearly:\n{{cursor}}', triggerText: 'rewrite' },
    { id: 'summarize', title: 'Summarize with decisions', content: 'Summarize decisions and open questions:\n{{cursor}}', triggerText: 'summary' },
    { id: 'translate', title: 'Translate naturally', content: 'Translate naturally while preserving tone:\n{{cursor}}', triggerText: 'translate' },
    { id: 'review', title: 'Review edge cases', content: 'Review this for missing states and edge cases:\n{{cursor}}', triggerText: 'review' },
    { id: 'title-only', title: '只按标题查找的提示词', content: '整理以下内容：\n{{cursor}}', triggerText: '' },
    ...Array.from({ length: 12 }, (_, index) => ({
        id: `long-${index}`, title: `长标题与中英文边界检查 ${index + 1} — A long reusable research Prompt`,
        content: '保持原始引用、公式和长段落，检查窄屏下的阅读与输入边界。 Preserve source, math and long paragraphs while keeping the editor usable.\n{{cursor}}',
        triggerText: `research${index + 1}`,
    })),
].map((prompt, index) => ({
    ...prompt,
    contexts: ['composer', 'readerComment'] as const,
    favorite: index === 0,
    enabled: index !== 3,
    createdAt: index + 1,
    updatedAt: index + 1,
    lastUsedAt: null,
}));
let failLoad = false;

const client = {
    listPrompts: async (options?: { includeDisabled?: boolean }) => {
        if (failLoad) throw new Error('The local fixture cannot load its Prompt records.');
        return params.get('empty') === '1' ? [] : prompts.filter((prompt) => options?.includeDisabled || prompt.enabled);
    },
    recordUse: async () => undefined,
    savePrompt: async (prompt: (typeof prompts)[number]) => prompt,
    deletePrompt: async () => undefined,
    restoreDefaults: async () => prompts,
};
const adapter = {
    getPlatformId: () => 'chatgpt',
    getComposerInputElement: () => composer,
    getComposerKind: () => 'textarea',
};
const controller = new ChatGPTPromptAutocompleteController(adapter as any, client as any);
controller.init();
controller.setEnabled(automaticToggle.checked);
const shortcuts = new ChatGPTShortcutController({
    copy: () => false,
    selection: () => false,
    navigate: () => false,
    prompts: controller,
});
shortcuts.setActive(true);
shortcuts.init();

let variant: VisualHarnessVariant = {
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    locale: params.get('locale') === 'zh_CN' ? 'zh_CN' : 'en',
};

async function showManualCandidates(): Promise<void> {
    controller.close();
    composer.focus();
    await controller.openSuggestions();
}

async function showAutocomplete(): Promise<void> {
    controller.close();
    composer.value = '\\rewrite';
    composer.setSelectionRange(composer.value.length, composer.value.length);
    composer.focus();
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
}

async function showManager(): Promise<void> {
    controller.close();
    await controller.openManager(managerTrigger);
}

async function showEditor(): Promise<void> {
    await showManager();
    const button = document.getElementById('aimd-chatgpt-prompt-popover-host')?.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="edit-prompt"]');
    button?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
}

async function prepareForAudit(): Promise<void> {
    const requested = new URLSearchParams(location.search).get('mode');
    if (requested === 'editor') await showEditor();
    else if (requested === 'manager') await showManager();
    else if (requested === 'manual') {
        composer.value = '';
        await showManualCandidates();
    }
    else if (document.documentElement.clientWidth <= 390) await showAutocomplete();
    else await showManager();
}

async function applyVariant(next: VisualHarnessVariant): Promise<void> {
    variant = next;
    document.documentElement.dataset.aimdTheme = next.theme;
    document.body.dataset.theme = next.theme;
    localeStatus.textContent = next.locale === 'zh_CN' ? '提示词联想' : 'Prompt completion';
    controller.setAppearance(createAppearanceSnapshot(next.theme));
    await setLocale(next.locale);
}

document.getElementById('autocomplete-trigger')?.addEventListener('click', () => void showAutocomplete());
document.getElementById('manual-trigger')?.addEventListener('click', () => void showManualCandidates());
automaticToggle.addEventListener('change', () => controller.setEnabled(automaticToggle.checked));
managerTrigger.addEventListener('click', () => void showManager());
document.getElementById('editor-trigger')?.addEventListener('click', () => { failLoad = false; void showEditor(); });
document.getElementById('error-trigger')?.addEventListener('click', () => { failLoad = !failLoad; void showManager(); });

installVisualHarnessBridge({
    applyVariant,
    prepareForAudit,
    getState: () => {
        const host = document.getElementById('aimd-chatgpt-prompt-popover-host');
        return {
            ...variant,
            expectedOpenSurfaces: [{ role: 'chatgpt-prompt-popover', count: host ? 1 : 0 }],
            localeEvidence: `${host?.shadowRoot?.textContent ?? ''} ${localeStatus.textContent ?? ''}`,
        };
    },
});

await applyVariant(variant);
await prepareForAudit();
window.addEventListener('pagehide', () => { shortcuts.dispose(); controller.dispose(); }, { once: true });
