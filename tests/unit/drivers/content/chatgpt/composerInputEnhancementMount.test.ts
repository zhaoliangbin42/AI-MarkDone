import { describe, expect, it } from 'vitest';
import {
    activateChatGPTComposerInputEnhancementMount,
    findChatGPTComposerInputEnhancementMount,
} from '@/drivers/content/chatgpt/composerInputEnhancementMount';
import { CHATGPT_COMPOSER_FIXTURE_HTML } from './fixtures/composer';

describe('findChatGPTComposerInputEnhancementMount', () => {
    it('returns a mount beside the official plus-button container', () => {
        document.body.innerHTML = CHATGPT_COMPOSER_FIXTURE_HTML;
        const composer = document.querySelector<HTMLElement>('#prompt-textarea')!;
        const plus = document.querySelector<HTMLButtonElement>('#composer-plus-btn')!;
        const officialContainer = plus.parentElement!;
        const leadingContainer = officialContainer.parentElement!;

        expect(findChatGPTComposerInputEnhancementMount(composer)).toEqual({
            container: leadingContainer,
            anchor: officialContainer,
            officialContainer,
            plusButton: plus,
        });
    });

    it('falls back to the stable plus button id', () => {
        const form = document.createElement('form');
        const row = document.createElement('span');
        const plus = document.createElement('button');
        const composer = document.createElement('div');
        plus.id = 'composer-plus-btn';
        row.appendChild(plus);
        form.append(row, composer);

        expect(findChatGPTComposerInputEnhancementMount(composer)).toEqual({
            container: row,
            anchor: plus,
            officialContainer: row,
            plusButton: plus,
        });
    });

    it('mounts beside the current ChatGPT add-context button without relying on its localized label', () => {
        document.body.innerHTML = '<form data-chatgpt-composer><div class="actions"><div><span><button data-composer-navigation-target="add-context" aria-label="添加文件等内容"></button></span></div></div><div data-composer-markdown contenteditable="true"></div></form>';
        const composer = document.querySelector<HTMLElement>('[data-composer-markdown]')!;
        const plus = document.querySelector<HTMLButtonElement>('[data-composer-navigation-target="add-context"]')!;
        expect(findChatGPTComposerInputEnhancementMount(composer)).toMatchObject({
            container: plus.parentElement!.parentElement,
            anchor: plus.parentElement,
            plusButton: plus,
        });
    });

    it('does not mount from a localized label alone', () => {
        const form = document.createElement('form');
        const plus = document.createElement('button');
        const composer = document.createElement('div');
        plus.setAttribute('aria-label', '添加照片和文件');
        form.append(plus, composer);

        expect(findChatGPTComposerInputEnhancementMount(composer)).toBeNull();
    });

    it('scopes and removes the parallel mount layout contract', () => {
        document.body.innerHTML = CHATGPT_COMPOSER_FIXTURE_HTML;
        const composer = document.querySelector<HTMLElement>('#prompt-textarea')!;
        const mount = findChatGPTComposerInputEnhancementMount(composer)!;

        const cleanup = activateChatGPTComposerInputEnhancementMount(mount.container, mount.officialContainer);

        expect(mount.container.dataset.aimdInputEnhancementMount).toBe('1');
        expect(document.getElementById('aimd-chatgpt-input-enhancement-mount-style')?.textContent)
            .toContain('[data-aimd-input-enhancement-mount="1"]');

        cleanup();
        expect(mount.container.dataset.aimdInputEnhancementMount).toBeUndefined();
        expect(document.getElementById('aimd-chatgpt-input-enhancement-mount-style')).toBeNull();
    });
});

it('keeps the shared composer row active until both entry owners release it', () => {
    const official=document.createElement('span');const row=document.createElement('div');row.append(official);document.body.append(row);
    const first=activateChatGPTComposerInputEnhancementMount(row,official);const second=activateChatGPTComposerInputEnhancementMount(row,official);
    first();expect(row.dataset.aimdInputEnhancementMount).toBe('1');first();expect(row.dataset.aimdInputEnhancementMount).toBe('1');
    second();expect(row.dataset.aimdInputEnhancementMount).toBeUndefined();row.remove();
});
