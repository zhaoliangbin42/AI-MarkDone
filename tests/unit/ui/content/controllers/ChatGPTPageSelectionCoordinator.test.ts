import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import { DOMContentSurfaceAdapter } from '@/drivers/content/adapters/ContentSurfaceAdapter';
import { ChatGPTPageSelectionCoordinator } from '@/ui/content/controllers/ChatGPTPageSelectionCoordinator';

function mountMessage(): HTMLElement {
    const message = document.createElement('div');
    message.dataset.messageAuthorRole = 'assistant';
    message.dataset.messageId = 'assistant-1';
    message.innerHTML = '<div class="markdown prose"><p><strong>Rendered</strong> text</p></div>';
    document.body.appendChild(message);
    return message;
}

function mountMessageWithDistantAtoms(): HTMLElement {
    const message = mountMessage();
    const root = message.querySelector<HTMLElement>('.markdown')!;
    root.appendChild(document.createElement('p')).textContent = 'A paragraph with no atom.';
    for (let index = 0; index < 50; index += 1) {
        const formula = document.createElement('span');
        formula.className = 'katex';
        formula.textContent = `x_${index}`;
        root.appendChild(formula);
    }
    return message;
}

function selectText(text: Text): void {
    const range = document.createRange();
    range.selectNodeContents(text);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

async function nextFrame(): Promise<void> {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
}
);

describe('ChatGPTPageSelectionCoordinator', () => {
    it('locates once per frame and publishes the same frame to all consumers', async () => {
        const message = mountMessage();
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), null);
        const locate = vi.spyOn(adapter, 'locateSelection');
        const coordinator = new ChatGPTPageSelectionCoordinator({ surfaceAdapter: adapter });
        const received: Array<unknown> = [];
        coordinator.subscribe((frame) => received.push(frame));
        coordinator.init();
        selectText(message.querySelector('strong')!.firstChild as Text);
        document.dispatchEvent(new Event('selectionchange'));
        document.dispatchEvent(new Event('selectionchange'));
        await nextFrame();

        expect(locate).toHaveBeenCalledTimes(1);
        expect(received).toHaveLength(1);
        expect(received[0]).toBe(coordinator.getCurrentFrame());
        coordinator.dispose();
    });

    it('does not scan the whole rendered response for a plain paragraph selection', async () => {
        const message = mountMessageWithDistantAtoms();
        const root = message.querySelector<HTMLElement>('.markdown')!;
        const paragraph = root.querySelectorAll('p')[1]!;
        const text = paragraph.firstChild as Text;
        const querySelectorAll = vi.spyOn(root, 'querySelectorAll');
        const adapter = new DOMContentSurfaceAdapter(new ChatGPTAdapter(), null);
        const coordinator = new ChatGPTPageSelectionCoordinator({ surfaceAdapter: adapter });
        coordinator.init();

        selectText(text);
        document.dispatchEvent(new Event('selectionchange'));
        await nextFrame();

        expect(querySelectorAll).not.toHaveBeenCalled();
        coordinator.dispose();
    });
});
