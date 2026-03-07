import { describe, expect, it } from 'vitest';
import { SiteAdapter, type ThemeDetector } from '@/drivers/content/adapters/base';
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
});
