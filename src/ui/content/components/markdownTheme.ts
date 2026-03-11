export function getMarkdownThemeCss(scope: string): string {
    const s = scope;
    return `
${s} {
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
  font-size: 15px;
  line-height: 1.75;
  word-break: break-word;
}
${s} > :first-child { margin-top: 0 !important; }
${s} > :last-child { margin-bottom: 0 !important; }
${s} :where(h1, h2, h3, h4, h5, h6) {
  margin: 1.5em 0 0.7em;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
${s} :where(h1) { font-size: 2em; padding-bottom: 0.28em; border-bottom: 1px solid var(--aimd-border-subtle); }
${s} :where(h2) { font-size: 1.5em; padding-bottom: 0.24em; border-bottom: 1px solid var(--aimd-border-subtle); }
${s} :where(h3) { font-size: 1.25em; }
${s} :where(h4) { font-size: 1em; }
${s} :where(h5) { font-size: 0.9em; }
${s} :where(h6) { font-size: 0.85em; color: var(--aimd-text-secondary); }
${s} :where(p, ul, ol, dl, table, blockquote, pre, hr) { margin: 0 0 1em; }
${s} :where(ul, ol) { padding-left: 1.6em; }
${s} :where(li + li) { margin-top: 0.3em; }
${s} :where(li > p) { margin-bottom: 0.5em; }
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
  padding: 0.1em 0 0.1em 1em;
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
  padding: 10px 12px;
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
  padding: 0.18em 0.42em;
  border-radius: var(--aimd-radius-sm);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 80%, transparent);
}
${s} :where(pre) {
  position: relative;
  overflow: auto;
  padding: 16px 18px;
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 84%, #0f172a 10%);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--aimd-bg-primary) 60%, transparent);
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
${s} :where(.hljs-comment, .hljs-quote) { color: #6e7781; }
${s} :where(.hljs-keyword, .hljs-selector-tag, .hljs-subst) { color: #cf222e; }
${s} :where(.hljs-number, .hljs-literal, .hljs-variable, .hljs-template-variable, .hljs-tag .hljs-attr) { color: #0550ae; }
${s} :where(.hljs-string, .hljs-doctag) { color: #0a3069; }
${s} :where(.hljs-title, .hljs-section, .hljs-selector-id) { color: #8250df; }
${s} :where(.hljs-type, .hljs-class .hljs-title) { color: #953800; }
${s} :where(.hljs-tag, .hljs-name, .hljs-attribute) { color: #116329; }
${s} :where(.hljs-meta, .hljs-meta .hljs-keyword) { color: #1f6feb; }
${s} :where(.hljs-addition) { color: #116329; background: rgba(46, 160, 67, 0.12); }
${s} :where(.hljs-deletion) { color: #82071e; background: rgba(248, 81, 73, 0.12); }
${s} :where(.task-list-item) { list-style: none; }
${s} :where(.task-list-item input) { margin: 0 0.5em 0.15em -1.4em; vertical-align: middle; }
`;
}
