import { describe, expect, it } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
import { ChatGPTAdapter } from '@/drivers/content/adapters/sites/chatgpt';
import type { MarkdownParserAdapter } from '@/drivers/content/adapters/parser/MarkdownParserAdapter';
import { copyMarkdownFromMessage } from '@/services/copy/copy-markdown';

const detector: ThemeDetector = {
    detect: () => 'light',
    getObserveTargets: () => [],
    hasExplicitTheme: () => false,
};

const parserAdapter: MarkdownParserAdapter = {
    name: 'Fake',
    isMathNode: () => false,
    isCodeBlockNode: () => false,
    extractLatex: () => null,
    getCodeLanguage: () => '',
    isBlockMath: () => false,
};

class FakeAdapter extends SiteAdapter {
    matches(): boolean {
        return true;
    }

    getPlatformId(): string {
        return 'unknown';
    }

    getThemeDetector(): ThemeDetector {
        return detector;
    }

    extractUserPrompt(): string | null {
        return null;
    }

    getMessageSelector(): string {
        return '.assistant';
    }

    getMessageContentSelector(): string {
        return '.content';
    }

    getActionBarSelector(): string {
        return '.actions';
    }

    isStreamingMessage(): boolean {
        return false;
    }

    getMessageId(): string | null {
        return 'fake-message';
    }

    getObserverContainer(): HTMLElement | null {
        return document.body;
    }

    getMarkdownParserAdapter(): MarkdownParserAdapter {
        return parserAdapter;
    }
}

describe('copyMarkdownFromMessage adapter contract', () => {
    it('uses adapter-provided parser capability instead of platformId branching', () => {
        document.body.innerHTML = `
          <div class="assistant">
            <div class="content"><p>Hello adapter contract</p></div>
            <div class="actions"></div>
          </div>
        `;

        const adapter = new FakeAdapter();
        const message = document.querySelector('.assistant');
        expect(message).toBeInstanceOf(HTMLElement);
        if (!(message instanceof HTMLElement)) return;

        const result = copyMarkdownFromMessage(adapter, message);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.markdown).toBe('Hello adapter contract');
    });

    it('lets ChatGPT remove source controls and link noise before copied markdown leaves the pipeline', () => {
        document.body.innerHTML = `
          <div data-message-author-role="assistant" data-message-id="a1">
            <div class="markdown prose">
<p>Useful answer <button>Huang 2020 Holographic MIMO Sur...</button></p>
<p>Read <a href="https://example.com/paper.pdf">paper</a> for details.</p>
<button>Sources</button>
            </div>
          </div>
        `;

        const adapter = new ChatGPTAdapter();
        const message = document.querySelector(adapter.getMessageSelector());
        expect(message).toBeInstanceOf(HTMLElement);
        if (!(message instanceof HTMLElement)) return;

        const result = copyMarkdownFromMessage(adapter, message);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.markdown).toBe('Useful answer\n\nRead paper for details.');
        expect(result.markdown).not.toContain('Huang 2020');
        expect(result.markdown).not.toContain('https://example.com');
        expect(result.markdown).not.toContain('Sources');
    });
});
