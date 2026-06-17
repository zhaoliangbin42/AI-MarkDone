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

    it('removes ChatGPT webpage citation pills and their empty state wrapper', () => {
        document.body.innerHTML = `
          <div data-message-author-role="assistant" data-message-id="a1">
            <div class="markdown prose">
<p>Useful answer<span data-state="closed"><span data-testid="webpage-citation-pill"><a href="https://github.blog/changelog/2026-03-25-updates-to-our-privacy-statement-and-terms-of-service-how-we-use-your-data/"><span>github.blog</span><span>+2</span></a></span></span> continues.</p>
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

        expect(result.markdown).toBe('Useful answer continues.');
        expect(result.markdown).not.toContain('github.blog');
        expect(result.markdown).not.toContain('+2');
        expect(result.markdown).not.toContain('https://github.blog');
    });

    it('unwraps ChatGPT component block chrome and keeps only the editor content', () => {
        document.body.innerHTML = `
          <div data-message-author-role="assistant" data-message-id="a1">
            <div class="markdown prose">
              <p>建议填写：</p>
              <div data-writing-block-fullscreen-fallback-target="inline">
                <div id="writing-block-1" data-writing-block="true" data-testid="writing-block-container">
                  <div data-testid="writing-block-header-surface">
                    <button>Edit</button>
                    <button>Copy</button>
                    <button aria-label="View in full screen">View in full screen</button>
                  </div>
                  <div class="writing-block-editor">
                    <div class="ProseMirror markdown prose" data-writing-block-fullscreen-editor-region="true">
                      <p>Yes. This manuscript was previously submitted to IEEE Internet of Things Journal.</p>
                    </div>
                  </div>
                </div>
              </div>
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

        expect(result.markdown).toBe([
            '建议填写：',
            'Yes. This manuscript was previously submitted to IEEE Internet of Things Journal.',
        ].join('\n\n'));
        expect(result.markdown).not.toContain('Edit');
        expect(result.markdown).not.toContain('Copy');
        expect(result.markdown).not.toContain('View in full screen');
    });

    it('deduplicates repeated ChatGPT component block views with the same id', () => {
        document.body.innerHTML = `
          <div data-message-author-role="assistant" data-message-id="a1">
            <div class="markdown prose">
              <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Shared generated text.</p></div>
              </div>
              <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Shared generated text.</p></div>
              </div>
              <div id="writing-block-repeat" data-writing-block="true" data-testid="writing-block-container">
                <div data-testid="writing-block-header-surface"><button>Edit</button></div>
                <div data-writing-block-fullscreen-editor-region="true"><p>Duplicate generated view with changed chrome.</p></div>
              </div>
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

        expect(result.markdown).toBe('Shared generated text.');
    });

    it('preserves rendered math as markdown formulas inside HTML table cells', () => {
        const mathParserAdapter: MarkdownParserAdapter = {
            ...parserAdapter,
            isMathNode: (node) => node.classList.contains('katex') || node.classList.contains('katex-display'),
            isBlockMath: (node) => node.classList.contains('katex-display'),
            extractLatex: (node) => ({ latex: node.getAttribute('data-latex') || '', isBlock: node.classList.contains('katex-display') }),
        };
        class MathTableAdapter extends FakeAdapter {
            getMarkdownParserAdapter(): MarkdownParserAdapter {
                return mathParserAdapter;
            }
        }

        document.body.innerHTML = `
          <div class="assistant">
            <div class="content">
              <table>
                <thead>
                  <tr><th>Formula</th><th>Meaning</th></tr>
                </thead>
                <tbody>
                  <tr><td><span class="katex" data-latex="x_1 + y">rendered math</span></td><td>inline math</td></tr>
                  <tr><td><span class="katex-display" data-latex="\\\\frac{a}{b}">rendered block math</span></td><td>display math in table</td></tr>
                </tbody>
              </table>
            </div>
            <div class="actions"></div>
          </div>
        `;

        const adapter = new MathTableAdapter();
        const message = document.querySelector('.assistant');
        expect(message).toBeInstanceOf(HTMLElement);
        if (!(message instanceof HTMLElement)) return;

        const result = copyMarkdownFromMessage(adapter, message);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.markdown).toContain('| $x_1 + y$ | inline math |');
        expect(result.markdown).toContain('| $\\\\frac{a}{b}$ | display math in table |');
        expect(result.markdown).not.toContain('rendered math');
    });
});
