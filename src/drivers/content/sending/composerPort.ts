import type { ComposerKind } from '../../../core/sending/types';
import { applyPlainTextToContenteditable, parseContenteditableToPlainText } from '../../../core/sending/contenteditable';
import type { SiteAdapter } from '../adapters/base';

export type WriteStrategy = 'auto' | 'inputEvent' | 'execCommand' | 'dom';

function getComposerInput(adapter: SiteAdapter): HTMLElement | HTMLTextAreaElement | HTMLInputElement | null {
    try {
        return adapter.getComposerInputElement?.() ?? null;
    } catch {
        return null;
    }
}

function getSendButton(adapter: SiteAdapter): HTMLElement | null {
    try {
        return adapter.getComposerSendButtonElement?.() ?? null;
    } catch {
        return null;
    }
}

function getComposerForm(
    input: HTMLElement | HTMLTextAreaElement | HTMLInputElement
): HTMLFormElement | null {
    const form = (input as HTMLElement).closest?.('form') ?? null;
    return form instanceof HTMLFormElement ? form : null;
}

function findSubmitter(form: HTMLFormElement, adapter: SiteAdapter): HTMLElement | null {
    const explicit = getSendButton(adapter);
    if (explicit) return explicit;

    const submit = form.querySelector('button[type="submit"], input[type="submit"]');
    return submit instanceof HTMLElement ? submit : null;
}

function tryRequestSubmit(form: HTMLFormElement, submitter: HTMLElement | null): boolean {
    try {
        // Best path: HTMLFormElement.requestSubmit triggers the platform's submit handlers without relying on button state.
        if (typeof (form as any).requestSubmit === 'function') {
            (form as any).requestSubmit(submitter ?? undefined);
            return true;
        }

        // Fallback: click an explicit submitter if present.
        if (submitter) {
            submitter.click();
            return true;
        }

        // Last resort: dispatch a submit event (SPA handlers can intercept).
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        return true;
    } catch {
        return false;
    }
}

function detectComposerKind(adapter: SiteAdapter, input: HTMLElement | HTMLTextAreaElement | HTMLInputElement): ComposerKind {
    try {
        const kind = adapter.getComposerKind?.();
        if (kind === 'textarea' || kind === 'contenteditable' || kind === 'unknown') return kind;
    } catch {
        // ignore
    }

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) return 'textarea';
    if (input.getAttribute('contenteditable') === 'true') return 'contenteditable';
    return 'unknown';
}

function isButtonDisabled(btn: HTMLElement): boolean {
    if (btn.hasAttribute('disabled')) return true;
    const aria = btn.getAttribute('aria-disabled');
    if (aria === 'true') return true;
    return false;
}

function setReactValue(input: HTMLTextAreaElement | HTMLInputElement, value: string): void {
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function applyTextToInput(input: HTMLElement | HTMLTextAreaElement | HTMLInputElement, kind: ComposerKind, text: string): void {
    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        setReactValue(input, text);
        return;
    }
    if (kind === 'contenteditable') {
        applyPlainTextToContenteditable(input, text);
        return;
    }
    input.textContent = text;
}

function tryInputEvent(input: HTMLElement | HTMLTextAreaElement | HTMLInputElement, kind: ComposerKind, text: string): boolean {
    try {
        applyTextToInput(input, kind, text);

        // Notify framework (legacy semantics).
        input.dispatchEvent(
            new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text,
            })
        );
        input.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                cancelable: false,
                inputType: 'insertText',
                data: text,
            })
        );
        return true;
    } catch {
        return false;
    }
}

function tryExecCommand(input: HTMLElement | HTMLTextAreaElement | HTMLInputElement, text: string, focusInput: boolean): boolean {
    try {
        if (focusInput) (input as HTMLElement).focus?.();
        return document.execCommand('insertText', false, text);
    } catch {
        return false;
    }
}

function tryDirectDom(input: HTMLElement | HTMLTextAreaElement | HTMLInputElement, kind: ComposerKind, text: string): boolean {
    try {
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            input.value = text;
        } else if (kind === 'contenteditable') {
            applyPlainTextToContenteditable(input, text);
        } else {
            input.textContent = text;
        }

        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    } catch {
        return false;
    }
}

export function readComposer(adapter: SiteAdapter): { ok: true; kind: ComposerKind; text: string } | { ok: false; message: string } {
    const input = getComposerInput(adapter);
    if (!input) return { ok: false, message: 'Composer input not found' };
    const kind = detectComposerKind(adapter, input);

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
        return { ok: true, kind, text: input.value };
    }

    if (kind === 'contenteditable' && input.getAttribute('contenteditable') === 'true') {
        return { ok: true, kind, text: parseContenteditableToPlainText(input) };
    }

    return { ok: true, kind, text: input.textContent || '' };
}

export async function clearComposer(
    adapter: SiteAdapter,
    opts?: { focus?: boolean }
): Promise<{ ok: true } | { ok: false; message: string }> {
    const input = getComposerInput(adapter);
    if (!input) return { ok: false, message: 'Composer input not found' };
    const focus = opts?.focus ?? true;
    const kind = detectComposerKind(adapter, input);

    try {
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            setReactValue(input, '');
            return { ok: true };
        }

        if (kind === 'contenteditable' && input.getAttribute('contenteditable') === 'true') {
            if (focus) {
                (input as HTMLElement).focus?.();
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(input);
                selection?.removeAllRanges();
                selection?.addRange(range);

                if (!document.execCommand('delete')) {
                    input.replaceChildren();
                }
            } else {
                input.replaceChildren();
            }
            return { ok: true };
        }

        input.replaceChildren();
        return { ok: true };
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'Clear failed' };
    }
}

export async function writeComposer(
    adapter: SiteAdapter,
    text: string,
    opts?: { focus?: boolean; strategy?: WriteStrategy }
): Promise<{ ok: true; kind: ComposerKind } | { ok: false; message: string }> {
    const input = getComposerInput(adapter);
    if (!input) return { ok: false, message: 'Composer input not found' };
    const kind = detectComposerKind(adapter, input);
    const focus = opts?.focus ?? true;
    const strategy = opts?.strategy ?? 'auto';

    if (focus) (input as HTMLElement).focus?.();

    // Clear first (legacy semantics).
    await clearComposer(adapter, { focus });

    const attempts: Array<() => boolean> =
        strategy === 'auto'
            ? [
                  () => tryInputEvent(input, kind, text),
                  () => tryExecCommand(input, text, focus),
                  () => tryDirectDom(input, kind, text),
              ]
            : strategy === 'inputEvent'
            ? [() => tryInputEvent(input, kind, text)]
            : strategy === 'execCommand'
            ? [() => tryExecCommand(input, text, focus)]
            : [() => tryDirectDom(input, kind, text)];

    for (const attempt of attempts) {
        if (attempt()) return { ok: true, kind };
    }
    return { ok: false, message: 'All write strategies failed' };
}

export async function waitSendReady(
    adapter: SiteAdapter,
    timeoutMs: number = 3000
): Promise<{ ok: true } | { ok: false; message: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const input = getComposerInput(adapter);
        const btn = getSendButton(adapter);
        if (btn && !isButtonDisabled(btn)) return { ok: true };

        // If the platform supports semantic form submission, treat it as ready once:
        // - composer exists
        // - text is non-empty
        // - a form exists
        // This avoids false negatives when the send button is disabled transiently (or not exposed reliably).
        if (input) {
            const form = getComposerForm(input);
            if (form) {
                const snap = readComposer(adapter);
                if (snap.ok && snap.text.length > 0) {
                    const submitter = findSubmitter(form, adapter);
                    const canSubmit = typeof (form as any).requestSubmit === 'function' || Boolean(submitter);
                    if (canSubmit) return { ok: true };
                }
            }
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    return { ok: false, message: 'Send button not ready' };
}

export function clickSend(adapter: SiteAdapter): { ok: true } | { ok: false; message: string } {
    const input = getComposerInput(adapter);
    if (input) {
        const form = getComposerForm(input);
        if (form) {
            const snap = readComposer(adapter);
            if (!snap.ok) return { ok: false, message: snap.message };
            if (snap.text.length === 0) return { ok: false, message: 'Empty message' };

            const submitter = findSubmitter(form, adapter);
            if (tryRequestSubmit(form, submitter)) return { ok: true };
        }
    }

    const btn = getSendButton(adapter);
    if (!btn) return { ok: false, message: 'Send button not found' };
    if (isButtonDisabled(btn)) return { ok: false, message: 'Send button disabled' };
    btn.click();
    return { ok: true };
}

export function watchSendButton(
    adapter: SiteAdapter,
    onChange: (isDisabled: boolean) => void
): () => void {
    const btn = getSendButton(adapter);
    if (!btn) return () => {};

    const check = () => onChange(isButtonDisabled(btn));
    const observer = new MutationObserver(() => check());
    observer.observe(btn, { attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'class'] });
    check();
    return () => observer.disconnect();
}
