import { describe, expect, it } from 'vitest';
import { StyleManager } from '../StyleManager';

describe('StyleManager markdown code block style contract', () => {
  it('defines dedicated code block visual tokens for readable hierarchy', () => {
    const css = StyleManager.getMarkdownStyles();

    expect(css).toContain('--codeBlock-bg');
    expect(css).toContain('--codeBlock-border');
    expect(css).toContain('--codeInline-bg');
    expect(css).toContain('.markdown-body pre {');
  });

  it('uses theme token driven code block background for mode-specific readability', () => {
    const css = StyleManager.getMarkdownStyles();
    expect(css).toContain('--codeBlock-bg: var(--aimd-code-block-bg)');
  });

  it('keeps markdown body typography baseline stable', () => {
    const css = StyleManager.getMarkdownStyles();
    expect(css).toContain('.markdown-body {');
    expect(css).toContain('color: var(--fgColor-default);');
    expect(css).toContain('font-size: 16px;');
    expect(css).toContain('line-height: 1.6;');
  });

  it('keeps inline code and block code visually distinct', () => {
    const css = StyleManager.getMarkdownStyles();
    expect(css).toContain('.markdown-body code {');
    expect(css).toContain('background: var(--codeInline-bg);');
    expect(css).toContain('.markdown-body pre {');
    expect(css).toContain('background: var(--codeBlock-bg);');
    expect(css).toContain('.markdown-body pre code {');
    expect(css).toContain('background: transparent;');
  });

  it('keeps table/blockquote/title hierarchy definitions present', () => {
    const css = StyleManager.getMarkdownStyles();
    expect(css).toContain('.markdown-body h1, .markdown-body h2 {');
    expect(css).toContain('.markdown-body table {');
    expect(css).toContain('.markdown-body th, .markdown-body td {');
    expect(css).toContain('.markdown-body blockquote {');
  });
});
