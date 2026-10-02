import '../browserExtensionMock';
import { DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS } from '../../../src/core/settings/types';
import type { SiteAdapter } from '../../../src/drivers/content/adapters/base';
import { armChatGPTSendPositionRestore, releaseChatGPTSendPositionRestore } from '../../../src/drivers/content/chatgpt/sendPositionRestoreEvents';
import { ChatGPTComposerEditingController } from '../../../src/ui/content/controllers/ChatGPTComposerEditingController';
import { ChatGPTSendPositionRestoreController } from '../../../src/ui/content/controllers/ChatGPTSendPositionRestoreController';

const root = document.querySelector<HTMLElement>('#thread')!;
const content = document.querySelector<HTMLElement>('#thread-content')!;
const composer = document.querySelector<HTMLTextAreaElement>('#prompt-textarea')!;
const form = document.querySelector<HTMLFormElement>('#composer-form')!;
const sendButton = document.querySelector<HTMLButtonElement>('#send-button')!;
const enabled = document.querySelector<HTMLInputElement>('#enabled')!;
const remountHistory = document.querySelector<HTMLInputElement>('#remount-history')!;
const reversed = new URLSearchParams(location.search).get('layout') === 'reverse';
remountHistory.checked = new URLSearchParams(location.search).get('remount') === '1';
root.dataset.layout = reversed ? 'reverse' : 'normal';
document.querySelector('#layout-name')!.textContent = reversed ? 'reverse / negative scrollTop' : 'normal';

const adapter = {
    getPlatformId: () => 'chatgpt',
    getMessageSelector: () => '[data-message-author-role="assistant"]',
    getComposerInputElement: () => composer,
    getMessageId: (el: HTMLElement) => el.dataset.messageId ?? null,
    extractUserPrompt: () => 'Placeholder fixture question',
} as unknown as SiteAdapter;

const restore = new ChatGPTSendPositionRestoreController(adapter);
restore.init();
restore.setEnabled(true);
restore.setEnterKeyNewlineEnabled(true);

const editing = new ChatGPTComposerEditingController(adapter);
editing.setInputEnhancementSettings({
    ...DEFAULT_CHATGPT_INPUT_ENHANCEMENT_SETTINGS,
    available: true,
    enabled: true,
    enterKeyNewline: true,
    formulaPreview: false,
    formulaSuggestions: false,
    lists: { enabled: false, ordered: false, unordered: false },
});
editing.init();

type SendMode = 'Pointer button' | 'Cmd/Ctrl+Enter' | 'Reader before-send';
let readingAnchor: HTMLElement;
let beforeTop: number | null = null;
let beforeAnchorTop: number | null = null;
let mode: SendMode | null = null;
let updates = 0;
let streaming = false;
let streamTimer: number | null = null;
let metricsRaf: number | null = null;

function show(id: string, value: string): void {
    document.getElementById(id)!.textContent = value;
}

function updateMetrics(): void {
    readingAnchor = document.getElementById('reading-anchor') ?? readingAnchor;
    const drift = beforeAnchorTop === null ? null : readingAnchor.getBoundingClientRect().top - beforeAnchorTop;
    show('send-mode', mode ?? 'Not sent');
    show('before-top', beforeTop === null ? '—' : beforeTop.toFixed(1));
    show('after-top', root.scrollTop.toFixed(1));
    show('anchor-drift', drift === null ? '—' : `${drift.toFixed(1)} px`);
    show('stream-updates', `${updates} / 30`);
    show('session-active', document.documentElement.getAttribute('data-aimd-chatgpt-send-restore-active') === 'true' ? 'Active' : 'Inactive');
    if (mode && !streaming && updates === 30) {
        show('fixture-result', drift !== null && Math.abs(drift) <= 3 ? 'PASS — reading anchor stayed in place' : 'MOVED — reading anchor left its position');
    }
}

function scheduleMetrics(): void {
    if (metricsRaf !== null) return;
    metricsRaf = requestAnimationFrame(() => {
        metricsRaf = null;
        updateMetrics();
    });
}

function jumpToBottom(): void {
    root.scrollTop = reversed ? 0 : root.scrollHeight - root.clientHeight;
    scheduleMetrics();
}

function recordBefore(nextMode: SendMode): void {
    if (streaming) return;
    mode = nextMode;
    beforeTop = root.scrollTop;
    beforeAnchorTop = readingAnchor.getBoundingClientRect().top;
    show('fixture-result', 'Sending placeholder content…');
    scheduleMetrics();
}

function createTurn(index: number): HTMLElement {
    const article = document.createElement('article');
    article.className = 'turn';
    article.dataset.messageAuthorRole = 'assistant';
    article.dataset.messageId = `fixture-reply-${index}`;
    const heading = document.createElement('h2');
    heading.textContent = `Placeholder reply ${index}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = 'A plain fixture paragraph used to check reading position. No account content, research draft, or message request is involved.';
    article.append(heading, paragraph);
    if (index === 10) {
        article.id = 'reading-anchor';
        paragraph.textContent = 'READING ANCHOR — this paragraph should remain at the same visual position while the placeholder reply streams.';
    }
    return article;
}

function reset(): void {
    if (streamTimer !== null) clearInterval(streamTimer);
    streamTimer = null;
    releaseChatGPTSendPositionRestore();
    content.replaceChildren(...Array.from({ length: 28 }, (_, i) => createTurn(i + 1)));
    readingAnchor = document.getElementById('reading-anchor')!;
    mode = null;
    beforeTop = null;
    beforeAnchorTop = null;
    updates = 0;
    streaming = false;
    composer.value = 'Placeholder fixture message';
    composer.focus({ preventScroll: true });
    root.scrollTop += readingAnchor.getBoundingClientRect().top - root.getBoundingClientRect().top - 35;
    show('fixture-result', 'Ready — reading older placeholder content');
    updateMetrics();
}

sendButton.addEventListener('pointerdown', () => recordBefore('Pointer button'));
// Model the host focus movement after native pointerdown and before native click.
sendButton.addEventListener('focus', jumpToBottom);
composer.addEventListener('focus', jumpToBottom);
window.addEventListener('keydown', (event) => {
    if (event.target === composer && event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {
        recordBefore('Cmd/Ctrl+Enter');
    }
}, { capture: true });
composer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.defaultPrevented) {
        event.preventDefault();
        form.requestSubmit(sendButton);
    }
});

form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (streaming) return;
    if (!mode) recordBefore('Pointer button');
    streaming = true;
    updates = 0;
    composer.value = '';
    if (remountHistory.checked) {
        for (const previous of Array.from(content.children)) previous.replaceWith(previous.cloneNode(true));
    }
    const reply = createTurn(29);
    content.append(reply);
    jumpToBottom();
    streamTimer = window.setInterval(() => {
        updates += 1;
        const paragraph = document.createElement('p');
        paragraph.textContent = `Placeholder continuation ${updates}. This update simulates reply growth and a host jump.`;
        reply.append(paragraph);
        jumpToBottom();
        if (updates === 30) {
            clearInterval(streamTimer!);
            streamTimer = null;
            streaming = false;
            window.setTimeout(updateMetrics, 100);
        }
        scheduleMetrics();
    }, 40);
});

document.getElementById('reader-send')!.addEventListener('click', () => {
    recordBefore('Reader before-send');
    armChatGPTSendPositionRestore();
    composer.focus();
    form.requestSubmit(sendButton);
});
document.getElementById('reset-history')!.addEventListener('click', reset);
enabled.addEventListener('change', () => {
    restore.setEnabled(enabled.checked);
    updateMetrics();
});
root.addEventListener('scroll', scheduleMetrics, { passive: true });
window.addEventListener('pagehide', () => {
    if (streamTimer !== null) clearInterval(streamTimer);
    if (metricsRaf !== null) cancelAnimationFrame(metricsRaf);
    editing.dispose();
    restore.dispose();
});

reset();
