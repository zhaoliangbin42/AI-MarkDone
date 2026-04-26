import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type ConversationGroupRef, type NoiseContext, type ThemeDetector } from '../base';
import { chatgptMarkdownParserAdapter } from '../parser/chatgpt';
import type { MarkdownParserAdapter } from '../parser/MarkdownParserAdapter';
import { logger } from '../../../../core/logger';
import { cleanChatGPTReferenceNoise } from '../../chatgpt/normalizeReaderMarkdown';

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

type ChatGPTStructuredTurn = {
    id?: string | null;
    role?: string | null;
    author?: { role?: string | null } | null;
    messages?: unknown[];
};

function readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown> | null | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export class ChatGPTAdapter extends SiteAdapter {
    private getTurnContainer(rootEl: HTMLElement): HTMLElement {
        const container = rootEl.closest('[data-turn-id-container]');
        return container instanceof HTMLElement ? container : rootEl;
    }

    private getTurnRootFromContainer(container: HTMLElement, role: 'user' | 'assistant'): HTMLElement | null {
        const selector = `section[data-turn="${role}"], article[data-turn="${role}"], [data-turn="${role}"]`;
        const turnRoot = container.matches(selector) ? container : container.querySelector(selector);
        return turnRoot instanceof HTMLElement ? turnRoot : null;
    }

    private getAssistantMessageFromRoot(assistantRootEl: HTMLElement): HTMLElement | null {
        const messageEl = assistantRootEl.matches(this.getMessageSelector())
            ? assistantRootEl
            : assistantRootEl.querySelector(this.getMessageSelector());
        return messageEl instanceof HTMLElement ? messageEl : null;
    }

    private normalizePromptText(text: string): string {
        return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
    }

    private extractUserPromptFromRoot(userRootEl: HTMLElement | null): string | null {
        if (!userRootEl) return null;
        const bubble =
            (userRootEl.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap') as HTMLElement | null) ||
            (userRootEl.querySelector('[data-message-author-role="user"]') as HTMLElement | null) ||
            (userRootEl.querySelector('.whitespace-pre-wrap') as HTMLElement | null);
        const normalized = this.normalizePromptText((bubble?.textContent || userRootEl.textContent || '').trim());
        return normalized || null;
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

            const fallbackUserMessage = cursor.querySelector('[data-message-author-role="user"]');
            if (fallbackUserMessage instanceof HTMLElement) {
                const fallbackRoot = fallbackUserMessage.closest('section[data-turn="user"], article[data-turn="user"], [data-turn="user"]');
                return fallbackRoot instanceof HTMLElement ? fallbackRoot : cursor;
            }

            cursor = cursor.previousElementSibling;
        }
        return null;
    }

    private collectGroupEls(userRootEl: HTMLElement | null, assistantRootEl: HTMLElement, barAnchorEl?: HTMLElement | null): HTMLElement[] {
        const nodes: HTMLElement[] = [];
        const push = (node: HTMLElement | null) => {
            if (node && !nodes.includes(node)) nodes.push(node);
        };

        push(barAnchorEl ?? (userRootEl ? this.getTurnContainer(userRootEl) : null));
        push(this.getTurnContainer(assistantRootEl));
        return nodes;
    }

    private getConversationDiscoveryRoot(): ParentNode {
        return this.getObserverContainer() ?? document;
    }

    private getStructuredTurnRole(turn: ChatGPTStructuredTurn | null): 'user' | 'assistant' | null {
        const role = readString(readRecord(turn?.author), 'role') ?? (typeof turn?.role === 'string' ? turn.role : null);
        if (role === 'user' || role === 'assistant') return role;
        const messages = Array.isArray(turn?.messages) ? turn.messages : [];
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = readRecord(messages[index]);
            const messageRole = readString(readRecord(message?.author) ?? message, 'role');
            if (messageRole === 'user' || messageRole === 'assistant') return messageRole;
        }
        return null;
    }

    private getReactRootCandidate(element: HTMLElement): any {
        for (const key of Object.keys(element)) {
            if (!key.startsWith('__reactFiber$') && !key.startsWith('__reactProps$')) continue;
            const value = (element as unknown as Record<string, unknown>)[key];
            if (value) return value;
        }
        return null;
    }

    private findStructuredTurnData(element: HTMLElement): ChatGPTStructuredTurn | null {
        let fiber = this.getReactRootCandidate(element);
        let depth = 0;

        while (fiber && depth < 12) {
            const candidates = [
                fiber.pendingProps,
                fiber.memoizedProps,
                fiber.pendingProps?.value,
                fiber.memoizedProps?.value,
            ].filter(Boolean) as Array<Record<string, unknown>>;

            for (const candidate of candidates) {
                const turn =
                    (candidate.turn as ChatGPTStructuredTurn | undefined)
                    ?? (candidate.currentTurn as ChatGPTStructuredTurn | undefined)
                    ?? (candidate.prevTurn as ChatGPTStructuredTurn | undefined)
                    ?? null;
                if (turn && this.getStructuredTurnRole(turn)) return turn;
            }

            fiber = fiber.return ?? null;
            depth += 1;
        }

        return null;
    }

    private isStructuredTextContent(record: Record<string, unknown>): boolean {
        const contentType = readString(record, 'content_type');
        return !contentType || contentType === 'text' || contentType === 'multimodal_text';
    }

    private normalizeStructuredText(value: unknown): string {
        if (typeof value === 'string') return value.trim();
        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeStructuredText(item)).filter(Boolean).join('\n\n').trim();
        }

        const record = readRecord(value);
        if (!record || !this.isStructuredTextContent(record)) return '';
        if (Array.isArray(record.parts)) {
            const combined = record.parts
                .map((part) => typeof part === 'string' ? part : '')
                .filter(Boolean)
                .join('\n')
                .trim();
            if (combined) return combined;
        }
        return readString(record, 'text') ?? readString(record, 'content') ?? readString(record, 'markdown') ?? '';
    }

    private getStructuredTurnText(turn: ChatGPTStructuredTurn | null, expectedRole: 'user' | 'assistant'): string {
        const messages = Array.isArray(turn?.messages) ? turn.messages : [];
        const texts = messages
            .filter((message) => {
                const record = readRecord(message);
                if (!record) return false;
                const role = readString(readRecord(record.author) ?? record, 'role') ?? this.getStructuredTurnRole(turn);
                if (role !== expectedRole) return false;
                const content = readRecord(record.content);
                return !content || this.isStructuredTextContent(content);
            })
            .map((message) => this.normalizeStructuredText(readRecord(message)?.content))
            .filter(Boolean);
        return texts[texts.length - 1] ?? '';
    }

    private getStructuredTurnMessageId(turn: ChatGPTStructuredTurn | null, expectedRole: 'user' | 'assistant'): string | null {
        const messages = Array.isArray(turn?.messages) ? turn.messages : [];
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const record = readRecord(messages[index]);
            if (!record) continue;
            const role = readString(readRecord(record.author) ?? record, 'role') ?? this.getStructuredTurnRole(turn);
            if (role !== expectedRole) continue;
            const id = readString(record, 'id');
            if (id) return id;
        }
        return typeof turn?.id === 'string' && turn.id.trim() ? turn.id.trim() : null;
    }

    private hasConversationGroupRef(refs: ConversationGroupRef[], assistantRootEl: HTMLElement, messageEl: HTMLElement, id: string): boolean {
        return refs.some((ref) => (
            ref.assistantRootEl === assistantRootEl
            || ref.assistantMessageEl === messageEl
            || ref.id === id
        ));
    }

    private finalizeConversationGroupRefs(refs: ConversationGroupRef[]): ConversationGroupRef[] {
        refs.sort((a, b) => {
            if (a.assistantRootEl === b.assistantRootEl) return 0;
            const position = a.assistantRootEl.compareDocumentPosition(b.assistantRootEl);
            if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return a.assistantIndex - b.assistantIndex;
        });
        return refs.map((ref, assistantIndex) => ({ ...ref, assistantIndex }));
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
                    const normalized = this.normalizePromptText(text);
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
                    const normalized = this.normalizePromptText(text);
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
        const refs: ConversationGroupRef[] = [];
        let assistantIndex = 0;
        const discoveryRoot = this.getConversationDiscoveryRoot();
        const turnContainers = Array.from(discoveryRoot.querySelectorAll('[data-turn-id-container]')).filter(
            (node): node is HTMLElement => node instanceof HTMLElement
        );

        if (turnContainers.length > 0) {
            let pendingUser: { container: HTMLElement; root: HTMLElement; prompt: string | null } | null = null;

            for (const container of turnContainers) {
                const userRootEl = this.getTurnRootFromContainer(container, 'user');
                const assistantRootEl = this.getTurnRootFromContainer(container, 'assistant');
                const structuredTurn = this.findStructuredTurnData(container);
                const structuredRole = this.getStructuredTurnRole(structuredTurn);

                if ((userRootEl && !assistantRootEl) || structuredRole === 'user') {
                    pendingUser = {
                        container,
                        root: userRootEl ?? container,
                        prompt: this.extractUserPromptFromRoot(userRootEl) ?? (this.getStructuredTurnText(structuredTurn, 'user') || null),
                    };
                    continue;
                }

                if (!assistantRootEl && structuredRole !== 'assistant') continue;

                const resolvedAssistantRootEl = assistantRootEl ?? container;
                const messageEl = this.getAssistantMessageFromRoot(resolvedAssistantRootEl) ?? container;
                if (messageEl !== container && !this.isVirtualizationEligibleMessage(messageEl)) continue;
                if (refs.some((ref) => ref.assistantRootEl === assistantRootEl)) continue;

                const pairedUser = pendingUser;
                const pairedUserRoot = pairedUser?.root ?? (assistantRootEl ? this.getUserTurnRootFromAssistantRoot(assistantRootEl) : null);
                const barAnchorEl = pairedUser?.container ?? (pairedUserRoot ? this.getTurnContainer(pairedUserRoot) : container);
                const id = this.getMessageId(messageEl)
                    || this.getStructuredTurnMessageId(structuredTurn, 'assistant')
                    || resolvedAssistantRootEl.getAttribute('data-turn-id')
                    || `chatgpt-group-${assistantIndex}`;
                if (this.hasConversationGroupRef(refs, resolvedAssistantRootEl, messageEl, id)) continue;

                refs.push({
                    id,
                    assistantRootEl: resolvedAssistantRootEl,
                    assistantMessageEl: messageEl,
                    userRootEl: pairedUserRoot,
                    userPromptText: pairedUser?.prompt ?? this.extractUserPromptFromRoot(pairedUserRoot),
                    barAnchorEl,
                    groupEls: this.collectGroupEls(pairedUserRoot, resolvedAssistantRootEl, barAnchorEl),
                    assistantIndex,
                    isStreaming: messageEl !== container && this.isStreamingMessage(messageEl),
                });
                assistantIndex += 1;
                pendingUser = null;
            }
        }

        const messages = Array.from(discoveryRoot.querySelectorAll(this.getMessageSelector())).filter(
            (node): node is HTMLElement => node instanceof HTMLElement
        );

        for (const messageEl of messages) {
            const assistantRootEl = this.getTurnRootElement(messageEl)
                ?? messageEl.closest('section[data-turn="assistant"], article[data-turn="assistant"], [data-turn="assistant"]') as HTMLElement | null
                ?? messageEl;
            if (!(assistantRootEl instanceof HTMLElement)) continue;
            if (!this.isVirtualizationEligibleMessage(messageEl)) continue;
            if (refs.some((ref) => ref.assistantRootEl === assistantRootEl)) continue;

            const userRootEl = this.getUserTurnRootFromAssistantRoot(assistantRootEl);
            const barAnchorEl = userRootEl ? this.getTurnContainer(userRootEl) : this.getTurnContainer(assistantRootEl);
            const groupEls = this.collectGroupEls(userRootEl, assistantRootEl, barAnchorEl);
            const id = this.getMessageId(messageEl)
                || `chatgpt-group-${assistantIndex}`;
            if (this.hasConversationGroupRef(refs, assistantRootEl, messageEl, id)) continue;

            refs.push({
                id,
                assistantRootEl,
                assistantMessageEl: messageEl,
                userRootEl,
                userPromptText: this.extractUserPromptFromRoot(userRootEl),
                barAnchorEl,
                groupEls,
                assistantIndex,
                isStreaming: this.isStreamingMessage(messageEl),
            });
            assistantIndex += 1;
        }

        return this.finalizeConversationGroupRefs(refs);
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

    cleanMarkdown(markdown: string): string {
        return cleanChatGPTReferenceNoise(markdown);
    }

    isNoiseNode(node: Node, context: NoiseContext): boolean {
        if (!(node instanceof HTMLElement)) return false;

        if (node.classList.contains('sr-only')) {
            return true;
        }

        if (this.isMarkdownControlNoise(node)) {
            return true;
        }

        if (context?.nextSibling?.hasAttribute('data-message-author-role')) {
            if (node.classList.contains('min-h-6') && node.querySelector('button span.truncate')) {
                return true;
            }
        }

        return false;
    }

    private isMarkdownControlNoise(node: HTMLElement): boolean {
        if (!node.closest('.markdown.prose, .markdown.prose.dark\\:prose-invert')) return false;
        if (node.matches('button')) return true;
        if (node.getAttribute('role') === 'button') return true;
        const label = `${node.getAttribute('aria-label') ?? ''} ${node.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
        if (!label) return false;
        return /^(sources?|引用|来源)$/i.test(label);
    }
}
