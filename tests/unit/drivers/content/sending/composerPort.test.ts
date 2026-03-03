import { describe, expect, it, vi } from 'vitest';
import type { SiteAdapter } from '../../../../../src/drivers/content/adapters/base';
import { clickSend, readComposer, waitSendReady, writeComposer } from '../../../../../src/drivers/content/sending/composerPort';
import { parseContenteditableToPlainText } from '../../../../../src/core/sending/contenteditable';

describe('composerPort', () => {
    it('writes to textarea via react-compatible value setter + input event', async () => {
        const textarea = document.createElement('textarea');
        const sendBtn = document.createElement('button');
        sendBtn.setAttribute('disabled', 'true');

        textarea.addEventListener('input', () => sendBtn.removeAttribute('disabled'));

        const adapter = {
            getComposerInputElement: () => textarea,
            getComposerSendButtonElement: () => sendBtn,
            getComposerKind: () => 'textarea',
        } as any as SiteAdapter;

        const res = await writeComposer(adapter, 'hello\nworld', { focus: false, strategy: 'auto' });
        expect(res.ok).toBe(true);
        expect(textarea.value).toBe('hello\nworld');

        const ready = await waitSendReady(adapter, 200);
        expect(ready.ok).toBe(true);
    });

    it('writes to contenteditable with safe <p>/<br> structure and dispatches input events', async () => {
        const editable = document.createElement('div');
        editable.id = 'prompt-textarea';
        editable.className = 'ProseMirror';
        editable.setAttribute('contenteditable', 'true');
        document.body.appendChild(editable);

        const sendBtn = document.createElement('button');
        sendBtn.setAttribute('disabled', 'true');

        editable.addEventListener('input', () => sendBtn.removeAttribute('disabled'));

        const adapter = {
            getComposerInputElement: () => editable,
            getComposerSendButtonElement: () => sendBtn,
            getComposerKind: () => 'contenteditable',
        } as any as SiteAdapter;

        const res = await writeComposer(adapter, 'a\n\nb', { focus: false, strategy: 'auto' });
        expect(res.ok).toBe(true);
        expect(parseContenteditableToPlainText(editable)).toBe('a\n\nb');

        const ready = await waitSendReady(adapter, 200);
        expect(ready.ok).toBe(true);
    });

    it('falls back to direct DOM when InputEvent and execCommand fail', async () => {
        const textarea = document.createElement('textarea');
        const sendBtn = document.createElement('button');

        const adapter = {
            getComposerInputElement: () => textarea,
            getComposerSendButtonElement: () => sendBtn,
            getComposerKind: () => 'textarea',
        } as any as SiteAdapter;

        const realInputEvent = globalThis.InputEvent;
        const realExecCommand = document.execCommand;
        (document as any).execCommand = vi.fn(() => false);
        (globalThis as any).InputEvent = function InputEvent() {
            throw new Error('boom');
        } as any;

        try {
            const res = await writeComposer(adapter, 'x', { focus: false, strategy: 'auto' });
            expect(res.ok).toBe(true);
            expect(textarea.value).toBe('x');
        } finally {
            (globalThis as any).InputEvent = realInputEvent;
            (document as any).execCommand = realExecCommand;
        }
    });

    it('clickSend clicks the send button when enabled', () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'hello';
        const form = document.createElement('form');
        const sendBtn = document.createElement('button');
        // ChatGPT uses `type="button"` for the send button; keep tests aligned with that behavior.
        sendBtn.type = 'button';
        const onClick = vi.fn();
        sendBtn.addEventListener('click', onClick);
        form.append(textarea, sendBtn);
        document.body.appendChild(form);

        const adapter = {
            getComposerInputElement: () => textarea,
            getComposerSendButtonElement: () => sendBtn,
        } as any as SiteAdapter;

        const clicked = clickSend(adapter);
        expect(clicked.ok).toBe(true);
        // requestSubmit path (or submitter click fallback) should submit via the form.
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('clickSend prefers form.requestSubmit when available (no button click required)', () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'hello';
        const form = document.createElement('form');
        form.appendChild(textarea);
        document.body.appendChild(form);

        const requestSubmit = vi.fn();
        (form as any).requestSubmit = requestSubmit;

        const adapter = {
            getComposerInputElement: () => textarea,
            getComposerSendButtonElement: () => null,
        } as any as SiteAdapter;

        const res = clickSend(adapter);
        expect(res.ok).toBe(true);
        expect(requestSubmit).toHaveBeenCalledTimes(1);
    });

    it('readComposer reads from textarea and contenteditable', () => {
        const textarea = document.createElement('textarea');
        textarea.value = 'hi';

        const adapter1 = { getComposerInputElement: () => textarea, getComposerKind: () => 'textarea' } as any as SiteAdapter;
        expect(readComposer(adapter1)).toEqual({ ok: true, kind: 'textarea', text: 'hi' });

        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        editable.innerHTML = '<p>a</p><p><br></p><p>b</p>';
        const adapter2 = { getComposerInputElement: () => editable, getComposerKind: () => 'contenteditable' } as any as SiteAdapter;
        expect(readComposer(adapter2)).toEqual({ ok: true, kind: 'contenteditable', text: 'a\n\nb' });
    });
});
