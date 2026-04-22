import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type ConversationGroupRef, type NoiseContext, type ThemeDetector } from '../base';
import { chatgptMarkdownParserAdapter } from '../parser/chatgpt';
import type { MarkdownParserAdapter } from '../parser/MarkdownParserAdapter';
import { logger } from '../../../../core/logger';

const detector: ThemeDetector = {
    detect(): Theme | null {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;
        if (document.documentElement.classList.contains('dark')) return 'dark';
        if (document.documentElement.classList.contains('light')) return 'light';
        return null;
    },
    getObserveTargets() {
        return [{ element: 'html', attributes: ['class', 'data-theme', 'style'] }];
    },
    hasExplicitTheme(): boolean {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        return htmlTheme === 'dark' || htmlTheme === 'light' || document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('light');
    },
};

export class ChatGPTAdapter extends SiteAdapter {
    private getTurnContainer(rootEl: HTMLElement): HTMLElement {
        const container = rootEl.closest('[data-turn-id-container]');
        return container instanceof HTMLElement ? container : rootEl;
    }

    private getUserTurnRootFromAssistantRoot(assistantRootEl: HTMLElement): HTMLElement | null {
        let cursor: Element | null = this.getTurnContainer(assistantRootEl).previousElementSibling;
        while (cursor) {
            if (!(cursor instanceof HTMLElement)) {
                cursor = cursor.previousElementSibling;
                continue;
            }

            const turnRoot =
                (cursor.matches?.('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]')
                    ? cursor
                    : cursor.querySelector?.('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]')) as HTMLElement | null;
            const userMessage = turnRoot?.querySelector?.('[data-message-author-role="user"]') as HTMLElement | null;
            if (turnRoot instanceof HTMLElement && userMessage instanceof HTMLElement) {
                return turnRoot;
            }

            const isFoldBar =
                cursor.classList.contains('aimd-chatgpt-foldbar')
                || cursor.querySelector?.('.aimd-chatgpt-foldbar');
            if (isFoldBar) {
                cursor = cursor.previousElementSibling;
                continue;
            }

            const fallbackUserMessage = cursor.querySelector('[data-message-author-role="user"]');
            if (fallbackUserMessage instanceof HTMLElement) {
                const fallbackRoot = fallbackUserMessage.closest('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]');
                return fallbackRoot instanceof HTMLElement ? fallbackRoot : cursor;
            }

            cursor = cursor.previousElementSibling;
        }
        return null;
    }

    private collectGroupEls(userRootEl: HTMLElement | null, assistantRootEl: HTMLElement): HTMLElement[] {
        const groupId = assistantRootEl.getAttribute('data-aimd-fold-group-id');
        const nodes: HTMLElement[] = [];
        const push = (node: HTMLElement | null) => {
            if (node && !nodes.includes(node)) nodes.push(node);
        };

        push(userRootEl);
        if (groupId) {
            const foldBar = document.querySelector(`.aimd-chatgpt-foldbar[data-aimd-fold-group-id="${groupId}"]`);
            push(foldBar instanceof HTMLElement ? foldBar : null);
        }
        push(assistantRootEl);
        return nodes;
    }

    private findOfficialActionAnchor(assistantMessageElement: HTMLElement): HTMLElement | null {
        const assistantArticle = assistantMessageElement.closest('article') || assistantMessageElement;
        const scopes: HTMLElement[] = [];
        const turnRoot = this.getTurnRootElement(assistantMessageElement);
        if (turnRoot) scopes.push(turnRoot);
        if (assistantArticle.parentElement instanceof HTMLElement) scopes.push(assistantArticle.parentElement);
        if (assistantArticle instanceof HTMLElement) scopes.push(assistantArticle);

        for (const scope of scopes) {
            const copyBtn = scope.querySelector(this.getActionBarSelector());
            if (!(copyBtn instanceof HTMLElement)) continue;
            const row = copyBtn.closest('div.z-0.flex');
            if (row instanceof HTMLElement) return row;
            if (copyBtn.parentElement instanceof HTMLElement) return copyBtn.parentElement;
        }

        return null;
    }

    matches(url: string): boolean {
        return url.includes('chatgpt.com') || url.includes('chat.openai.com');
    }

    getPlatformId(): string {
        return 'chatgpt';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    getMarkdownParserAdapter(): MarkdownParserAdapter {
        return chatgptMarkdownParserAdapter;
    }

    shouldEnhanceUnrenderedMath(): boolean {
        return true;
    }

    extractUserPrompt(assistantMessageElement: HTMLElement): string | null {
        const normalize = (text: string): string =>
            text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();

        const assistantArticle = assistantMessageElement.closest('article') || assistantMessageElement;
        const scope = assistantArticle.parentElement;
        if (scope) {
            const turns = Array.from(scope.querySelectorAll('article[data-turn]')).filter(
                (n): n is HTMLElement => n instanceof HTMLElement
            );
            const idx = turns.indexOf(assistantArticle as HTMLElement);
            if (idx >= 0) {
                for (let i = idx - 1; i >= 0; i -= 1) {
                    const turn = turns[i];
                    if (turn.getAttribute('data-turn') !== 'user') continue;

                    const bubble =
                        (turn.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap') as HTMLElement | null) ||
                        (turn.querySelector('[data-message-author-role="user"]') as HTMLElement | null) ||
                        (turn.querySelector('.whitespace-pre-wrap') as HTMLElement | null);

                    const text = (bubble?.textContent || turn.textContent || '').trim();
                    const normalized = normalize(text);
                    return normalized || null;
                }
            }
        }

        // Fallback: walk backwards to find the nearest user-role node.
        let cursor: HTMLElement | null = assistantArticle as HTMLElement;
        while (cursor) {
            let prev: Element | null = cursor.previousElementSibling;
            while (prev) {
                const user =
                    (prev.matches?.('article[data-turn="user"]') ? (prev as HTMLElement) : null) ||
                    (prev.querySelector?.('[data-message-author-role="user"]') as HTMLElement | null);
                if (user) {
                    const text = (user.textContent || '').trim();
                    const normalized = normalize(text);
                    return normalized || null;
                }
                prev = prev.previousElementSibling;
            }
            cursor = cursor.parentElement;
        }

        return null;
    }

    getMessageSelector(): string {
        // Prefer the stable assistant message node; `article[data-turn]` has proven to be unstable across ChatGPT UI iterations.
        // Using the role+id container keeps Copy/Reader/toolbars resilient even if the surrounding turn wrapper changes.
        return '[data-message-author-role="assistant"][data-message-id]';
    }

    getMessageContentSelector(): string {
        return '.markdown.prose, .markdown.prose.dark\\:prose-invert';
    }

    getActionBarSelector(): string {
        return 'button[data-testid="copy-turn-action-button"]';
    }

    getToolbarAnchorElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        return this.findOfficialActionAnchor(assistantMessageElement);
    }

    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        const el = assistantMessageElement.closest?.('[data-testid^="conversation-turn-"]');
        return el instanceof HTMLElement ? el : null;
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        try {
            const targetRow = this.findOfficialActionAnchor(messageElement);
            if (!targetRow) return false;
            const actionBarAnchor = targetRow.querySelector(this.getActionBarSelector());
            const group = actionBarAnchor instanceof HTMLElement ? actionBarAnchor.parentElement as HTMLElement | null : null;

            toolbarHost.dataset.aimdPlacement = 'actionbar';
            toolbarHost.setAttribute('data-aimd-role', 'message-toolbar');
            toolbarHost.style.pointerEvents = 'auto';
            toolbarHost.style.marginLeft = '0';
            toolbarHost.style.marginRight = '0';

            if (actionBarAnchor instanceof HTMLElement && group && group.parentElement === targetRow) {
                targetRow.insertBefore(toolbarHost, group.nextSibling);
            } else if (actionBarAnchor instanceof HTMLElement) {
                targetRow.insertBefore(toolbarHost, actionBarAnchor);
            } else {
                targetRow.appendChild(toolbarHost);
            }
            return true;
        } catch (err) {
            logger.warn('[AI-MarkDone][ChatGPTAdapter] injectToolbar failed', err);
            return false;
        }
    }

    isStreamingMessage(element: HTMLElement): boolean {
        if (this.findOfficialActionAnchor(element)) {
            return false;
        }

        const stopButton = document.querySelector('button[aria-label*="Stop"]');
        if (!stopButton) return false;

        const messages = document.querySelectorAll(this.getMessageSelector());
        if (messages.length === 0) return false;
        const lastMessage = messages[messages.length - 1];
        return lastMessage === element;
    }

    getMessageId(element: HTMLElement): string | null {
        const dataMessageId = element.getAttribute('data-message-id');
        if (dataMessageId) return dataMessageId;

        const dataTestId = element.getAttribute('data-testid');
        if (dataTestId) return dataTestId;

        const dataTurn = element.getAttribute('data-turn');
        if (dataTurn) {
            const allMessages = document.querySelectorAll(this.getMessageSelector());
            const index = Array.from(allMessages).indexOf(element);
            return index >= 0 ? `chatgpt-${dataTurn}-${index}` : `chatgpt-${dataTurn}`;
        }

        const allMessages = document.querySelectorAll(this.getMessageSelector());
        const index = Array.from(allMessages).indexOf(element);
        return index >= 0 ? `chatgpt-${index}` : null;
    }

    getObserverContainer(): HTMLElement | null {
        const selectors = ['main', 'main [role="presentation"]', 'main > div', '#__next', 'body'];
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container instanceof HTMLElement) return container;
        }
        return null;
    }

    getConversationScrollRoot(): HTMLElement | null {
        const seed =
            this.getLastMessageElement()
            || this.getObserverContainer()
            || document.querySelector('main');

        let cursor: HTMLElement | null = seed instanceof HTMLElement ? seed : null;
        while (cursor) {
            const style = window.getComputedStyle(cursor);
            const overflowY = style.overflowY;
            const scrollable = (overflowY === 'auto' || overflowY === 'scroll') && cursor.scrollHeight > cursor.clientHeight;
            if (scrollable) return cursor;
            cursor = cursor.parentElement;
        }
        const main = document.querySelector('main');
        if (main instanceof HTMLElement) return main;
        return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
    }

    getConversationGroupRefs(): ConversationGroupRef[] {
        const messages = Array.from(document.querySelectorAll(this.getMessageSelector())).filter(
            (node): node is HTMLElement => node instanceof HTMLElement
        );
        const refs: ConversationGroupRef[] = [];
        let assistantIndex = 0;

        for (const messageEl of messages) {
            const assistantRootEl = this.getTurnRootElement(messageEl) ?? messageEl.closest('section[data-turn="assistant"]') as HTMLElement | null ?? messageEl;
            if (!(assistantRootEl instanceof HTMLElement)) continue;
            if (!this.isVirtualizationEligibleMessage(messageEl)) continue;
            if (refs.some((ref) => ref.assistantRootEl === assistantRootEl)) continue;

            const userRootEl = this.getUserTurnRootFromAssistantRoot(assistantRootEl);
            const groupEls = this.collectGroupEls(userRootEl, assistantRootEl);
            const id = assistantRootEl.getAttribute('data-aimd-fold-group-id')
                || this.getMessageId(messageEl)
                || `chatgpt-group-${assistantIndex}`;

            refs.push({
                id,
                assistantRootEl,
                assistantMessageEl: messageEl,
                userRootEl,
                groupEls,
                assistantIndex,
                isStreaming: this.isStreamingMessage(messageEl),
            });
            assistantIndex += 1;
        }

        return refs;
    }

    getHeavySubtreeRefs(bodyEls: HTMLElement[]): HTMLElement[] {
        const seen = new Set<HTMLElement>();
        const refs: HTMLElement[] = [];
        for (const bodyEl of bodyEls) {
            const matches = bodyEl.querySelectorAll('.katex-display, .katex, math, pre');
            matches.forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                if (seen.has(node)) return;
                seen.add(node);
                refs.push(node);
            });
        }
        return refs;
    }

    isVirtualizationEligibleMessage(messageElement: HTMLElement): boolean {
        return !this.isStreamingMessage(messageElement);
    }

    getHeaderIconAnchorElement(): HTMLElement | null {
        const anchor = document.querySelector('#page-header #conversation-header-actions');
        return anchor instanceof HTMLElement ? anchor : null;
    }

    injectHeaderIcon(iconHost: HTMLElement): boolean {
        const anchor = this.getHeaderIconAnchorElement();
        if (!anchor) return false;

        if (iconHost instanceof HTMLElement) {
            iconHost.className =
                'text-token-text-primary no-draggable hover:bg-token-surface-hover keyboard-focused:bg-token-surface-hover touch:h-10 touch:w-10 flex h-9 w-9 items-center justify-center rounded-lg focus:outline-none disabled:opacity-50';
            iconHost.style.width = '36px';
            iconHost.style.height = '36px';
            iconHost.style.minWidth = '36px';
            iconHost.style.minHeight = '36px';
            iconHost.style.background = 'transparent';
            iconHost.style.border = '0';
            iconHost.style.padding = '0';
            const icon = iconHost.querySelector('img');
            if (icon instanceof HTMLElement) {
                icon.style.width = '22px';
                icon.style.height = '22px';
            }
        }

        anchor.insertBefore(iconHost, anchor.firstChild);
        return true;
    }

    // =========================
    // Composer (message sending)
    // =========================

    getComposerKind(): 'textarea' | 'contenteditable' | 'unknown' {
        return 'contenteditable';
    }

    getComposerInputElement(): HTMLElement | HTMLTextAreaElement | HTMLInputElement | null {
        // Prefer the real ProseMirror editor root (textarea is often hidden and not the source of truth).
        const editable = document.querySelector('#prompt-textarea.ProseMirror[contenteditable="true"]');
        if (editable instanceof HTMLElement) return editable;

        const fallbackEditable = document.querySelector('[contenteditable="true"]#prompt-textarea');
        if (fallbackEditable instanceof HTMLElement) return fallbackEditable;

        const textarea = document.querySelector('textarea[name="prompt-textarea"]');
        if (textarea instanceof HTMLTextAreaElement) return textarea;

        return null;
    }

    getComposerSendButtonElement(): HTMLElement | null {
        // Only return the explicit send button when present.
        // Why: the composer submit control can be multi-state (voice/dictate vs send).
        // Our sending driver prefers semantic form submission (requestSubmit) and uses this only as a fallback.
        const btn = document.querySelector('button[data-testid="send-button"]');
        return btn instanceof HTMLElement ? btn : null;
    }

    isComposerStreaming(): boolean {
        // Best-effort: if Stop button exists, streaming is likely in progress.
        const stopButton = document.querySelector('button[aria-label*="Stop"], button[aria-label*="停止"]');
        return !!stopButton;
    }

    isNoiseNode(node: Node, context: NoiseContext): boolean {
        if (!(node instanceof HTMLElement)) return false;

        if (node.classList.contains('sr-only')) {
            return true;
        }

        if (context?.nextSibling?.hasAttribute('data-message-author-role')) {
            if (node.classList.contains('min-h-6') && node.querySelector('button span.truncate')) {
                return true;
            }
        }

        return false;
    }
}
