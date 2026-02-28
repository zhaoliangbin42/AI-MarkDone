import { logger } from '../../core/logger';
import type { SiteAdapter } from '../../drivers/content/adapters/base';
import { enhanceUnrenderedMath } from './preprocess/math-extractor';
import { createMarkdownParser } from '../markdown-parser/createMarkdownParser';
import type { IPlatformAdapter } from '../markdown-parser/adapters/IPlatformAdapter';
import { ChatGPTAdapter as ChatGPTParserAdapter } from '../markdown-parser/adapters/ChatGPTAdapter';
import { GeminiAdapter as GeminiParserAdapter } from '../markdown-parser/adapters/GeminiAdapter';
import { ClaudeAdapter as ClaudeParserAdapter } from '../markdown-parser/adapters/ClaudeAdapter';
import { DeepseekAdapter as DeepseekParserAdapter } from '../markdown-parser/adapters/DeepseekAdapter';

export type CopyMarkdownResult =
    | { ok: true; markdown: string }
    | { ok: false; error: { code: 'NO_MESSAGE' | 'UNSUPPORTED_SITE' | 'INTERNAL_ERROR'; message: string } };

function removeNoiseNodes(root: HTMLElement, adapter: SiteAdapter): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const toProcess: Array<{ node: HTMLElement; placeholder: string | null }> = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const el = node as HTMLElement;
        const nextSibling = el.nextElementSibling;
        try {
            if (adapter.isNoiseNode(el, { nextSibling })) {
                const placeholder = adapter.getArtifactPlaceholder(el);
                toProcess.push({ node: el, placeholder });
            }
        } catch (err) {
            logger.warn('[AI-MarkDone][Copy] isNoiseNode threw; skipping node', err);
        }
    }

    toProcess.reverse().forEach(({ node: el, placeholder }) => {
        if (!el.parentNode) return;
        if (placeholder) {
            const p = document.createElement('p');
            p.textContent = placeholder;
            el.parentNode.replaceChild(p, el);
        } else {
            el.parentNode.removeChild(el);
        }
    });
}

function getParserAdapter(platformId: string): IPlatformAdapter | null {
    switch (platformId) {
        case 'chatgpt':
            return new ChatGPTParserAdapter();
        case 'gemini':
            return new GeminiParserAdapter();
        case 'claude':
            return new ClaudeParserAdapter();
        case 'deepseek':
            return new DeepseekParserAdapter();
        default:
            return null;
    }
}

function resolveContentRoot(adapter: SiteAdapter, messageElement: HTMLElement): HTMLElement | null {
    if (messageElement.tagName.toLowerCase() === 'article') {
        return messageElement;
    }

    if (typeof adapter.isDeepResearchMessage === 'function' && adapter.isDeepResearchMessage(messageElement)) {
        if (typeof adapter.getDeepResearchContent === 'function') {
            const panelContent = adapter.getDeepResearchContent();
            if (panelContent) {
                logger.info('[AI-MarkDone][Copy] Deep Research panel content detected; using panel root');
                return panelContent;
            }
        }
    }

    const contentSelector = adapter.getMessageContentSelector();
    if (!contentSelector) return messageElement;

    const contentElement = messageElement.querySelector(contentSelector);
    return contentElement instanceof HTMLElement ? contentElement : messageElement;
}

export function copyMarkdownFromMessage(adapter: SiteAdapter, messageElement: HTMLElement): CopyMarkdownResult {
    const parserAdapter = getParserAdapter(adapter.getPlatformId());
    if (!parserAdapter) {
        return { ok: false, error: { code: 'UNSUPPORTED_SITE', message: 'Unsupported platform.' } };
    }

    const root = resolveContentRoot(adapter, messageElement);
    if (!root) {
        return { ok: false, error: { code: 'NO_MESSAGE', message: 'No message content found.' } };
    }

    try {
        const clone = root.cloneNode(true) as HTMLElement;
        adapter.normalizeDOM(clone);
        removeNoiseNodes(clone, adapter);

        if (adapter.shouldEnhanceUnrenderedMath()) {
            enhanceUnrenderedMath(clone);
        }

        const parser = createMarkdownParser(parserAdapter, { enablePerformanceLogging: false });
        const markdown = parser.parse(clone);
        return { ok: true, markdown };
    } catch (err) {
        logger.error('[AI-MarkDone][Copy] copyMarkdownFromMessage failed', err);
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to build markdown.' } };
    }
}

export function copyMarkdownFromPage(adapter: SiteAdapter): CopyMarkdownResult {
    const message = adapter.getLastMessageElement();
    if (!message) {
        return { ok: false, error: { code: 'NO_MESSAGE', message: 'No assistant message found.' } };
    }
    return copyMarkdownFromMessage(adapter, message);
}
