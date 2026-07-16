import '../browserExtensionMock';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

const [
    { ChatGPTPromptAutocompleteController },
    { createAppearanceSnapshot },
    { setLocale },
] = await Promise.all([
    import('../../../src/ui/content/controllers/ChatGPTPromptAutocompleteController'),
    import('../../../src/style/appearance'),
    import('../../../src/ui/content/components/i18n'),
]);

const composer = document.getElementById('composer') as HTMLTextAreaElement;
const managerTrigger = document.getElementById('manager-trigger') as HTMLButtonElement;
const localeStatus = document.getElementById('locale-status') as HTMLSpanElement;
const prompts = [
    { id: 'rewrite', title: 'Rewrite clearly', content: 'Rewrite this clearly:\n{{cursor}}', triggerText: 'rewrite' },
    { id: 'summarize', title: 'Summarize with decisions', content: 'Summarize decisions and open questions:\n{{cursor}}', triggerText: 'summary' },
    { id: 'translate', title: 'Translate naturally', content: 'Translate naturally while preserving tone:\n{{cursor}}', triggerText: 'translate' },
    { id: 'review', title: 'Review edge cases', content: 'Review this for missing states and edge cases:\n{{cursor}}', triggerText: 'review' },
].map((prompt, index) => ({
    ...prompt,
    contexts: ['composer', 'readerComment'] as const,
    favorite: index === 0,
    enabled: index !== 3,
    createdAt: index + 1,
    updatedAt: index + 1,
    lastUsedAt: null,
}));

const client = {
    listPrompts: async (options?: { includeDisabled?: boolean }) => prompts.filter((prompt) => options?.includeDisabled || prompt.enabled),
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

let variant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

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

async function prepareForAudit(): Promise<void> {
    if (document.documentElement.clientWidth <= 390) await showAutocomplete();
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
managerTrigger.addEventListener('click', () => void showManager());

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
