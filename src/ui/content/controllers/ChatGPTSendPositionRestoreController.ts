import type { SiteAdapter } from '../../../drivers/content/adapters/base';
import { collectConversationTurnRefs } from '../../../drivers/content/conversation/collectConversationTurnRefs';
import {
    CHATGPT_SEND_POSITION_RESTORE_ARM_EVENT,
    CHATGPT_SEND_POSITION_RESTORE_RELEASE_EVENT,
} from '../../../drivers/content/chatgpt/sendPositionRestoreEvents';

type RestoreAnchor = {
    el: HTMLElement;
    top: number;
};

type RestoreSession = {
    root: HTMLElement;
    savedTop: number;
    anchor: RestoreAnchor | null;
    observer: MutationObserver | null;
    rafId: number | null;
    timeoutId: number | null;
    restoreCount: number;
    scrollTarget: EventTarget;
};

const ACTIVE_ATTR = 'data-aimd-chatgpt-send-restore-active';
const STYLE_ID = 'aimd-chatgpt-send-restore-style';
const BOTTOM_THRESHOLD_PX = 160;
const RESTORE_TOLERANCE_PX = 2;
const MAX_RESTORE_ATTEMPTS = 20;
const TTL_MS = 90_000;

export class ChatGPTSendPositionRestoreController {
    private enabled = false;
    private initialized = false;
    private session: RestoreSession | null = null;

    constructor(private readonly adapter: SiteAdapter) {}

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        this.ensureStyle();
        window.addEventListener(CHATGPT_SEND_POSITION_RESTORE_ARM_EVENT, this.onArm);
        window.addEventListener(CHATGPT_SEND_POSITION_RESTORE_RELEASE_EVENT, this.onRelease);
        document.addEventListener('keydown', this.onKeyDownCapture, { capture: true });
        document.addEventListener('click', this.onClickCapture, { capture: true });
        document.addEventListener('submit', this.onSubmitCapture, { capture: true });
        document.addEventListener('wheel', this.onUserAbort, { capture: true, passive: true });
        document.addEventListener('touchmove', this.onUserAbort, { capture: true, passive: true });
        document.addEventListener('pointerdown', this.onUserAbort, { capture: true });
    }

    dispose(): void {
        if (!this.initialized) return;
        this.release();
        this.initialized = false;
        window.removeEventListener(CHATGPT_SEND_POSITION_RESTORE_ARM_EVENT, this.onArm);
        window.removeEventListener(CHATGPT_SEND_POSITION_RESTORE_RELEASE_EVENT, this.onRelease);
        document.removeEventListener('keydown', this.onKeyDownCapture, { capture: true } as any);
        document.removeEventListener('click', this.onClickCapture, { capture: true } as any);
        document.removeEventListener('submit', this.onSubmitCapture, { capture: true } as any);
        document.removeEventListener('wheel', this.onUserAbort, { capture: true } as any);
        document.removeEventListener('touchmove', this.onUserAbort, { capture: true } as any);
        document.removeEventListener('pointerdown', this.onUserAbort, { capture: true } as any);
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) this.release();
    }

    private onArm = (): void => this.arm();
    private onRelease = (): void => this.release();
    private onUserAbort = (): void => this.release();

    private onKeyDownCapture = (event: KeyboardEvent): void => {
        if (this.isSendEnter(event)) {
            this.arm();
            return;
        }
        this.release();
    };

    private onClickCapture = (event: MouseEvent): void => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest('button, [role="button"]') ?? null;
        if (button && this.isSendButton(button)) this.arm();
        else if (this.isScrollToBottomTarget(target)) this.release();
    };

    private onSubmitCapture = (event: SubmitEvent): void => {
        const form = event.target;
        if (form instanceof HTMLFormElement && this.hasComposer(form)) this.arm();
    };

    private arm(): void {
        if (!this.enabled) return;
        const root = this.findScrollRoot();
        if (!root || this.distanceToBottom(root) <= BOTTOM_THRESHOLD_PX) return;

        this.release();
        const scrollTarget = this.getScrollEventTarget(root);
        this.session = {
            root,
            savedTop: root.scrollTop,
            anchor: this.captureAnchor(root),
            observer: null,
            rafId: null,
            timeoutId: window.setTimeout(() => this.release(), TTL_MS),
            restoreCount: 0,
            scrollTarget,
        };
        document.documentElement.setAttribute(ACTIVE_ATTR, 'true');
        scrollTarget.addEventListener('scroll', this.scheduleRestore, { passive: true });
        this.observeRoot(root);
    }

    private release(): void {
        const session = this.session;
        if (!session) {
            document.documentElement.setAttribute(ACTIVE_ATTR, 'false');
            return;
        }
        session.observer?.disconnect();
        if (session.rafId != null) window.cancelAnimationFrame(session.rafId);
        if (session.timeoutId != null) window.clearTimeout(session.timeoutId);
        session.scrollTarget.removeEventListener('scroll', this.scheduleRestore as any);
        this.session = null;
        document.documentElement.setAttribute(ACTIVE_ATTR, 'false');
    }

    private observeRoot(root: HTMLElement): void {
        if (!this.session || typeof MutationObserver !== 'function') return;
        const target = root === document.documentElement || root === document.body || root === document.scrollingElement
            ? document.body || document.documentElement
            : root;
        const observer = new MutationObserver(() => this.scheduleRestore());
        observer.observe(target, { childList: true, subtree: true });
        this.session.observer = observer;
    }

    private scheduleRestore = (): void => {
        const session = this.session;
        if (!session || session.rafId != null) return;
        session.rafId = window.requestAnimationFrame(() => {
            if (!this.session) return;
            this.session.rafId = null;
            this.restoreNow();
        });
    };

    private restoreNow(): void {
        const session = this.session;
        if (!session) return;
        const targetTop = this.resolveRestoreTop(session);
        if (Math.abs(session.root.scrollTop - targetTop) <= RESTORE_TOLERANCE_PX) return;
        session.root.scrollTop = Math.max(0, targetTop);
        session.restoreCount += 1;
        if (session.restoreCount >= MAX_RESTORE_ATTEMPTS) this.release();
    }

    private resolveRestoreTop(session: RestoreSession): number {
        const anchor = session.anchor;
        if (anchor?.el.isConnected) {
            const delta = anchor.el.getBoundingClientRect().top - anchor.top;
            if (Math.abs(delta) > RESTORE_TOLERANCE_PX) {
                return session.root.scrollTop + delta;
            }
        }
        return session.savedTop;
    }

    private captureAnchor(root: HTMLElement): RestoreAnchor | null {
        const candidates = this.collectAnchors(root);
        let best: HTMLElement | null = null;
        let bestTop = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            if (!candidate.isConnected) continue;
            const rect = candidate.getBoundingClientRect();
            if (rect.height <= 0) continue;
            const distance = Math.abs(rect.top);
            if (distance < bestDistance) {
                best = candidate;
                bestTop = rect.top;
                bestDistance = distance;
            }
        }
        return best ? { el: best, top: bestTop } : null;
    }

    private collectAnchors(root: HTMLElement): HTMLElement[] {
        const anchors: HTMLElement[] = [];
        try {
            for (const turn of collectConversationTurnRefs(this.adapter)) {
                const anchor = turn.jumpAnchorEl ?? turn.userRootEl ?? turn.turnRootEl ?? turn.primaryMessageEl;
                if (anchor instanceof HTMLElement && root.contains(anchor) && !anchors.includes(anchor)) anchors.push(anchor);
            }
        } catch {
            // Restore must stay best-effort and never block sending.
        }
        if (anchors.length > 0) return anchors;
        return Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="conversation-turn-"], [data-message], [data-message-author-role]'));
    }

    private findScrollRoot(): HTMLElement | null {
        let best: HTMLElement | null = null;
        let bestScrollable = 0;
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('main, [role="main"], div, section, article'))) {
            const style = window.getComputedStyle(el);
            if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
            const scrollable = el.scrollHeight - el.clientHeight;
            if (scrollable > bestScrollable) {
                best = el;
                bestScrollable = scrollable;
            }
        }
        const fallback = document.scrollingElement;
        return best ?? (fallback instanceof HTMLElement ? fallback : document.documentElement);
    }

    private distanceToBottom(root: HTMLElement): number {
        return root.scrollHeight - root.scrollTop - root.clientHeight;
    }

    private getScrollEventTarget(root: HTMLElement): EventTarget {
        return root === document.documentElement || root === document.body || root === document.scrollingElement ? window : root;
    }

    private isSendEnter(event: KeyboardEvent): boolean {
        return event.key === 'Enter'
            && !event.shiftKey
            && !event.metaKey
            && !event.ctrlKey
            && !event.altKey
            && !event.isComposing
            && event.target instanceof Element
            && this.hasComposer(event.target);
    }

    private hasComposer(root: Element): boolean {
        return Boolean(root.closest('#prompt-textarea, textarea, [contenteditable="true"], [contenteditable=""]')
            ?? root.querySelector?.('#prompt-textarea, textarea, [contenteditable="true"], [contenteditable=""]'));
    }

    private isSendButton(button: Element): boolean {
        if (button.getAttribute('data-testid') === 'send-button') return true;
        if (button.matches('button[data-testid*="send" i], button[aria-label*="send" i], button[aria-label*="发送"], .composer-submit-button-color')) return true;
        if (button instanceof HTMLButtonElement && button.type === 'submit') return Boolean(button.closest('form')?.querySelector('#prompt-textarea, textarea, [contenteditable="true"], [contenteditable=""]'));
        return false;
    }

    private isScrollToBottomTarget(target: Element | null): boolean {
        const button = target?.closest('button, [role="button"]');
        if (!button) return false;
        const label = `${button.getAttribute('aria-label') || ''} ${button.textContent || ''}`.toLowerCase();
        return /scroll.*bottom|bottom|到底|滚动到底|跳到底/.test(label);
    }

    private ensureStyle(): void {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `html[${ACTIVE_ATTR}="true"], html[${ACTIVE_ATTR}="true"] * { overflow-anchor: none; }`;
        (document.head || document.documentElement).appendChild(style);
    }
}
