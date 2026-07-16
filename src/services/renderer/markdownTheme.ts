export function getMarkdownThemeCss(scope: string): string {
    const s = scope;
    return `
${s} {
  --_reader-md-heading-flow: 1.5em 0 0.7em;
  --_reader-md-h1-rule-offset: 0.28em;
  --_reader-md-h2-rule-offset: 0.24em;
  --_reader-md-block-flow: 0 0 1em;
  --_reader-md-list-inset: 1.6em;
  --_reader-md-item-flow: 0.3em;
  --_reader-md-item-paragraph-flow: 0.5em;
  --_reader-md-quote-inset: 0.1em 0 0.1em 1em;
  --_reader-md-table-cell-inset: 10px 12px;
  --_reader-md-inline-code-inset: 0.18em 0.42em;
  --_reader-md-code-block-inset: 16px 18px;
  --_reader-md-code-block-effect: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 60%, transparent);
  --_reader-md-task-control-space: 0.65em;
  --_reader-md-task-check-flow: 0.22em 0 0;
  --_reader-md-formula-inset: 0.35em 0.1em;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
  font-size: var(--aimd-reader-markdown-body-size, var(--aimd-text-base));
  line-height: 1.72;
  word-break: break-word;
}
${s} > :first-child { margin-top: 0; }
${s} > :last-child { margin-bottom: 0; }
${s} :where(h1, h2, h3, h4, h5, h6) {
  margin: var(--_reader-md-heading-flow);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.25;
  letter-spacing: -0.02em;
}
${s} :where(h1) { font-size: 2em; padding-bottom: var(--_reader-md-h1-rule-offset); border-bottom: 1px solid var(--aimd-border-subtle); }
${s} :where(h2) { font-size: 1.5em; padding-bottom: var(--_reader-md-h2-rule-offset); border-bottom: 1px solid var(--aimd-border-subtle); }
${s} :where(h3) { font-size: 1.25em; }
${s} :where(h4) { font-size: 1em; }
${s} :where(h5) { font-size: 0.9em; }
${s} :where(h6) { font-size: 0.85em; color: var(--aimd-text-secondary); }
${s} :where(p, ul, ol, dl, table, blockquote, pre, hr) { margin: var(--_reader-md-block-flow); }
${s} :where(ul, ol) { padding-left: var(--_reader-md-list-inset); }
${s} :where(li + li) { margin-top: var(--_reader-md-item-flow); }
${s} :where(li > p) { margin-bottom: var(--_reader-md-item-paragraph-flow); }
${s} :where(a) {
  color: var(--aimd-text-link);
  text-decoration: none;
  text-underline-offset: 0.2em;
}
${s} :where(a:hover) { color: var(--aimd-text-link-hover); text-decoration: underline; }
${s} :where(strong) { font-weight: 700; }
${s} :where(em) { font-style: italic; }
${s} :where(hr) {
  height: 1px;
  border: 0;
  background: var(--aimd-border-subtle);
}
${s} :where(blockquote) {
  margin-left: 0;
  padding: var(--_reader-md-quote-inset);
  color: var(--aimd-text-secondary);
  border-left: 4px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 56%, transparent);
  border-radius: 0 var(--aimd-radius-md) var(--aimd-radius-md) 0;
}
${s} :where(table) {
  width: 100%;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  border-spacing: 0;
}
${s} :where(th, td) {
  padding: var(--_reader-md-table-cell-inset);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
}
${s} :where(th) {
  font-weight: 700;
  background: color-mix(in srgb, var(--aimd-bg-secondary) 72%, transparent);
}
${s} :where(tr:nth-child(2n)) td {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 36%, transparent);
}
${s} :where(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--aimd-radius-lg);
}
${s} :where(code) {
  font-family: var(--aimd-font-family-mono);
  font-size: 0.92em;
  padding: var(--_reader-md-inline-code-inset);
  border-radius: var(--aimd-radius-sm);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 80%, transparent);
}
${s} :where(pre) {
  position: relative;
  overflow: auto;
  padding: var(--_reader-md-code-block-inset);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 88%, var(--aimd-text-primary) 4%);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  box-shadow: var(--_reader-md-code-block-effect);
}
${s} :where(pre code) {
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  white-space: pre;
  line-height: 1.65;
}
${s} :where(.hljs) {
  background: transparent;
  color: var(--aimd-text-primary);
}
${s} :where(.hljs-comment, .hljs-quote) { color: var(--aimd-text-tertiary); }
${s} :where(.hljs-keyword, .hljs-selector-tag, .hljs-subst) { color: color-mix(in srgb, var(--aimd-color-danger) 76%, var(--aimd-interactive-primary)); }
${s} :where(.hljs-number, .hljs-literal, .hljs-variable, .hljs-template-variable, .hljs-tag .hljs-attr) { color: color-mix(in srgb, var(--aimd-interactive-primary) 78%, var(--aimd-text-primary)); }
${s} :where(.hljs-string, .hljs-doctag) { color: color-mix(in srgb, var(--aimd-state-success-border) 72%, var(--aimd-text-primary)); }
${s} :where(.hljs-title, .hljs-section, .hljs-selector-id) { color: color-mix(in srgb, var(--aimd-text-link) 68%, var(--aimd-text-primary)); }
${s} :where(.hljs-type, .hljs-class .hljs-title) { color: color-mix(in srgb, var(--aimd-color-warning) 68%, var(--aimd-text-primary)); }
${s} :where(.hljs-tag, .hljs-name, .hljs-attribute) { color: color-mix(in srgb, var(--aimd-state-success-border) 80%, var(--aimd-text-primary)); }
${s} :where(.hljs-meta, .hljs-meta .hljs-keyword) { color: color-mix(in srgb, var(--aimd-text-link) 84%, var(--aimd-bg-primary)); }
${s} :where(.hljs-addition) { color: color-mix(in srgb, var(--aimd-state-success-border) 82%, var(--aimd-text-primary)); background: color-mix(in srgb, var(--aimd-state-success-border) 14%, transparent); }
${s} :where(.hljs-deletion) { color: color-mix(in srgb, var(--aimd-color-danger) 82%, var(--aimd-text-primary)); background: color-mix(in srgb, var(--aimd-color-danger) 12%, transparent); }
${s} :where(.contains-task-list) {
  padding-left: 0;
  list-style: none;
}
${s} :where(.task-list-item) {
  display: flex;
  align-items: flex-start;
  gap: var(--_reader-md-task-control-space);
  list-style: none;
}
${s} :where(.task-list-item input) {
  margin: var(--_reader-md-task-check-flow);
  accent-color: var(--aimd-interactive-primary);
}
${s} :where(.katex-display) {
  display: block;
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--_reader-md-formula-inset);
}
`;
}
