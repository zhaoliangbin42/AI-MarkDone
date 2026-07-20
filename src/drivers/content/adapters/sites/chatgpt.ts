import type { Theme } from '../../../../core/types/theme';
import { SiteAdapter, type ConversationGroupRef, type NoiseContext, type ThemeDetector } from '../base';
import { chatgptMarkdownParserAdapter } from '../parser/chatgpt';
import type { MarkdownParserAdapter } from '../parser/MarkdownParserAdapter';
import { logger } from '../../../../core/logger';
import { cleanChatGPTReferenceNoise } from '../../chatgpt/normalizeReaderMarkdown';
import {
    collectChatGPTDomRoundRefs,
    disposeChatGPTPageIndex,
    type ChatGPTDomRoundRef,
} from '../../chatgpt/domConversationDiscovery';
import { disposeChatGPTConversationIndex } from '../../chatgpt/ChatGPTConversationIndex';

const DEEP_RESEARCH_SCREENSHOT_ROOT_SELECTOR = '[data-conversation-screenshot-content]';
const DEEP_RESEARCH_IFRAME_SELECTOR = `${DEEP_RESEARCH_SCREENSHOT_ROOT_SELECTOR} iframe[title="internal://deep-research"]`;

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
    private conversationGroupCache: {
        rounds: ChatGPTDomRoundRef[];
        groups: ConversationGroupRef[];
    } | null = null;

    private normalizePromptText(text: string): string {
        return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
    }

    private findOfficialActionAnchor(assistantMessageElement: HTMLElement): HTMLElement | null {
        const assistantArticle = assistantMessageElement.closest('article') || assistantMessageElement;
        const scopes: HTMLElement[] = [];
        const turnRoot = this.getTurnRootElement(assistantMessageElement);
        if (turnRoot) scopes.push(turnRoot);
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

    private findDeepResearchFrame(messageElement: HTMLElement): HTMLIFrameElement | null {
        const candidate = messageElement.matches(DEEP_RESEARCH_IFRAME_SELECTOR)
            ? messageElement
            : messageElement.querySelector(DEEP_RESEARCH_IFRAME_SELECTOR);
        return candidate instanceof HTMLIFrameElement ? candidate : null;
    }

    private findDeepResearchToolbarAnchor(messageElement: HTMLElement): HTMLElement | null {
        const frame = this.findDeepResearchFrame(messageElement);
        if (!frame) return null;

        const screenshotRoot = frame.closest(DEEP_RESEARCH_SCREENSHOT_ROOT_SELECTOR);
        if (!(screenshotRoot instanceof HTMLElement)) return null;

        let contentStack: HTMLElement = frame;
        while (contentStack.parentElement && contentStack.parentElement !== screenshotRoot) {
            contentStack = contentStack.parentElement;
        }
        return contentStack.parentElement === screenshotRoot ? contentStack : screenshotRoot;
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
        // Deep Research is the only verified embedded surface that lacks this node and therefore supplies its iframe as the message surface.
        return `[data-message-author-role="assistant"][data-message-id], ${DEEP_RESEARCH_IFRAME_SELECTOR}`;
    }

    getMessageContentSelector(): string {
        return '.markdown.prose, .markdown.prose.dark\\:prose-invert';
    }

    getActionBarSelector(): string {
        return 'button[data-testid="copy-turn-action-button"]';
    }

    getToolbarAnchorElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        return this.findOfficialActionAnchor(assistantMessageElement)
            ?? this.findDeepResearchToolbarAnchor(assistantMessageElement);
    }

    getTurnRootElement(assistantMessageElement: HTMLElement): HTMLElement | null {
        const selectors = [
            '[data-testid^="conversation-turn-"]',
            '[data-turn-id-container]',
            'article[data-turn="assistant"]',
            'section[data-turn="assistant"]',
        ];
        for (const selector of selectors) {
            const candidate = assistantMessageElement.closest?.(selector);
            if (candidate instanceof HTMLElement) return candidate;
        }
        return null;
    }

    injectToolbar(messageElement: HTMLElement, toolbarHost: HTMLElement): boolean {
        try {
            const officialActionAnchor = this.findOfficialActionAnchor(messageElement);
            const deepResearchAnchor = officialActionAnchor
                ? null
                : this.findDeepResearchToolbarAnchor(messageElement);
            const targetRow = officialActionAnchor ?? deepResearchAnchor;
            if (!targetRow) return false;
            const actionBarAnchor = officialActionAnchor?.querySelector(this.getActionBarSelector()) ?? null;
            const group = actionBarAnchor instanceof HTMLElement ? actionBarAnchor.parentElement as HTMLElement | null : null;

            toolbarHost.dataset.aimdPlacement = 'actionbar';
            toolbarHost.setAttribute('data-aimd-role', 'message-toolbar');
            toolbarHost.style.pointerEvents = 'auto';
            toolbarHost.style.marginLeft = '0';
            toolbarHost.style.marginRight = '0';

            if (deepResearchAnchor) {
                toolbarHost.dataset.aimdSurface = 'deep-research';
                toolbarHost.style.alignSelf = 'flex-end';
                deepResearchAnchor.appendChild(toolbarHost);
                return true;
            }

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
        if (this.findDeepResearchFrame(element)) {
            const turnRoot = this.getTurnRootElement(element);
            const turnId = turnRoot?.getAttribute('data-turn-id')
                || turnRoot?.getAttribute('data-turn-id-container')
                || turnRoot?.getAttribute('data-testid');
            if (turnId) return turnId;
        }

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
        const main = document.querySelector('main');
        if (main instanceof HTMLElement) return main.parentElement ?? main;

        const appRoot = document.querySelector('#__next');
        return appRoot instanceof HTMLElement ? appRoot : document.body;
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
        const rounds = collectChatGPTDomRoundRefs(this);
        if (this.conversationGroupCache?.rounds === rounds) {
            return this.conversationGroupCache.groups;
        }

        const groups = rounds.map((roundRef, assistantIndex) => ({
            id: roundRef.id,
            assistantRootEl: roundRef.assistantRootEl,
            assistantMessageEl: roundRef.assistantMessageEl,
            assistantContentRootEl: roundRef.assistantContentRootEl,
            userRootEl: roundRef.userRootEl,
            barAnchorEl: roundRef.jumpAnchorEl,
            groupEls: roundRef.groupEls,
            assistantIndex,
            isStreaming: roundRef.isStreaming,
        }));
        this.conversationGroupCache = { rounds, groups };
        return groups;
    }

    dispose(): void {
        disposeChatGPTConversationIndex(this);
        disposeChatGPTPageIndex(this);
        this.conversationGroupCache = null;
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

    normalizeDOM(root: HTMLElement): void {
        this.unwrapComponentBlocks(root);

        root.querySelectorAll('[data-testid="webpage-citation-pill"]').forEach((pill) => {
            const wrapper = pill.parentElement;
            pill.remove();

            if (
                wrapper instanceof HTMLElement &&
                wrapper.matches('span[data-state]') &&
                wrapper.childNodes.length === 0
            ) {
                wrapper.remove();
            }
        });
    }

    private unwrapComponentBlocks(root: HTMLElement): void {
        const seenBlocks = new Set<string>();
        for (const container of this.findComponentBlockContainers(root)) {
            if (!root.contains(container)) continue;
            const editor = this.findComponentBlockEditor(container);
            if (!editor) continue;
            const replaceTarget = this.getComponentBlockReplaceTarget(container);

            const normalizedText = (editor.textContent || '').replace(/\s+/g, ' ').trim();
            const blockId = container.id.trim();
            if (blockId && normalizedText && seenBlocks.has(blockId)) {
                this.removeAdjacentWhitespace(replaceTarget);
                replaceTarget.remove();
                continue;
            }
            if (blockId && normalizedText) seenBlocks.add(blockId);

            const replacement = document.createDocumentFragment();
            editor.childNodes.forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) return;
                replacement.appendChild(child.cloneNode(true));
            });
            this.removeAdjacentWhitespace(replaceTarget);
            replaceTarget.replaceWith(replacement);
        }
    }

    private getComponentBlockReplaceTarget(container: HTMLElement): HTMLElement {
        const parent = container.parentElement;
        if (!parent) return container;
        const isFallbackTarget = Array.from(parent.attributes).some((attr) => (
            /^data-[a-z0-9-]+-block[a-z0-9-]*-fallback-target$/i.test(attr.name)
        ));
        if (!isFallbackTarget) return container;
        const elementChildren = Array.from(parent.children).filter((child) => child instanceof HTMLElement);
        return elementChildren.length === 1 && elementChildren[0] === container ? parent : container;
    }

    private removeAdjacentWhitespace(element: HTMLElement): void {
        const previous = element.previousSibling;
        if (previous?.nodeType === Node.TEXT_NODE && !previous.textContent?.trim()) previous.remove();
        const next = element.nextSibling;
        if (next?.nodeType === Node.TEXT_NODE && !next.textContent?.trim()) next.remove();
    }

    private findComponentBlockContainers(root: HTMLElement): HTMLElement[] {
        const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
        return candidates.filter((element) => {
            const testId = element.getAttribute('data-testid') || '';
            if (testId.endsWith('-block-container')) return true;
            return Array.from(element.attributes).some((attr) => (
                /^data-[a-z0-9-]+-block$/i.test(attr.name) && attr.value === 'true'
            ));
        });
    }

    private findComponentBlockEditor(container: HTMLElement): HTMLElement | null {
        for (const element of Array.from(container.querySelectorAll<HTMLElement>('*'))) {
            const hasEditorRegion = Array.from(element.attributes).some((attr) => (
                /^data-[a-z0-9-]+-editor-region$/i.test(attr.name) && attr.value === 'true'
            ));
            if (hasEditorRegion) return element;
        }
        return null;
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
