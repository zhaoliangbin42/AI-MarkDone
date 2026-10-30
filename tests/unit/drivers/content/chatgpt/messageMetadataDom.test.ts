import { afterEach, expect, it } from 'vitest';
import { ChatGPTMessageMetadataReader } from '@/drivers/content/chatgpt/ChatGPTMessageMetadataReader';
const conversation = '12345678-abcd-4abc-8def-1234567890ab';
afterEach(() => { document.body.replaceChildren(); history.replaceState({}, '', '/'); });
it('reads only the matching turn timestamp and labels it as prompt time when cache is absent', () => {
    history.replaceState({}, '', `/c/${conversation}`);
    document.body.innerHTML = `<div data-turn-key="prompt-1"><div role="separator" data-markdown-copy="exclude"><time datetime="2026-10-21T11:12:20.354Z"></time></div><div data-dil-message-id="assistant-1"></div></div><div data-turn-key="prompt-2"><div data-dil-message-id="assistant-2"><time datetime="2026-01-01T00:00:00Z"></time></div></div>`;
    const reader = new ChatGPTMessageMetadataReader();
    expect(reader.read(conversation, 'assistant-1')).toEqual({ promptCreatedAt: Date.parse('2026-10-21T11:12:20.354Z') });
    expect(reader.read(conversation, 'assistant-2')).toBeNull();
    expect(reader.read('other', 'assistant-1')).toBeNull();
    document.querySelector('time')!.setAttribute('datetime', 'bad');
    expect(reader.read(conversation, 'assistant-1')).toBeNull();
});
