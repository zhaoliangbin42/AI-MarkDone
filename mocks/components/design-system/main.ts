import { Icons } from '../../../src/assets/icons';
import { ensureStyle } from '../../../src/style/shadow';
import { getTokenCss } from '../../../src/style/tokens';

type Theme = 'light' | 'dark';

const palette = [
    ['Canvas', '--aimd-bg-primary'],
    ['Surface', '--aimd-bg-surface'],
    ['Subtle', '--aimd-bg-secondary'],
    ['Text', '--aimd-text-primary'],
    ['Muted text', '--aimd-text-secondary'],
    ['Border', '--aimd-border-default'],
    ['Accent', '--aimd-interactive-primary'],
    ['Accent soft', '--aimd-interactive-selected'],
    ['Warning', '--aimd-color-warning'],
    ['Danger', '--aimd-color-danger'],
];

function icon(svg: string): string {
    return `<span class="aimd-icon" aria-hidden="true">${svg}</span>`;
}

function getShowcaseCss(): string {
    return `
:host {
  display: block;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}

* {
  box-sizing: border-box;
}

.showcase {
  display: grid;
  gap: var(--aimd-space-5);
  padding: var(--aimd-space-5);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-primary);
  box-shadow: var(--aimd-shadow-lg);
}

.showcase__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--aimd-space-4);
}

.showcase__eyebrow,
.section__kicker,
.type-spec,
.meta {
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
  color: var(--aimd-text-secondary);
}

.showcase__title {
  margin: 0;
  font-size: var(--aimd-text-xl);
  line-height: var(--aimd-panel-title-line-height);
  font-weight: var(--aimd-font-semibold);
}

.showcase__copy {
  margin: var(--aimd-space-1) 0 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.theme-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-2);
  min-height: var(--aimd-size-control-compact);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-medium);
  white-space: nowrap;
}

.section {
  display: grid;
  gap: var(--aimd-space-3);
}

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--aimd-space-3);
}

.section__title {
  margin: 0;
  font-size: var(--aimd-text-base);
  font-weight: var(--aimd-font-semibold);
  line-height: 1.35;
}

.palette-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--aimd-space-2);
}

.swatch {
  min-width: 0;
  display: grid;
  grid-template-columns: var(--aimd-size-control-action-panel) minmax(0, 1fr);
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  border-radius: var(--aimd-radius-lg);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 72%, var(--aimd-bg-primary));
}

.swatch__chip {
  width: var(--aimd-size-control-action-panel);
  height: var(--aimd-size-control-action-panel);
  border-radius: var(--aimd-radius-md);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 70%, transparent);
  background: var(--swatch);
}

.swatch__name,
.type-row strong,
.bookmark-row__title,
.reader-card h3 {
  color: var(--aimd-text-primary);
}

.swatch__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.swatch__token {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--aimd-text-secondary);
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-xs);
}

.type-stack {
  display: grid;
  gap: var(--aimd-space-2);
}

.type-row {
  display: grid;
  gap: 2px;
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
}

.type-row--title strong {
  font-size: var(--aimd-text-xl);
  line-height: var(--aimd-panel-title-line-height);
}

.type-row--body strong {
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-normal);
}

.type-row--label strong {
  font-size: var(--aimd-text-xs);
  line-height: var(--aimd-leading-normal);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aimd-space-2);
}

.btn,
.icon-btn,
.segmented button,
.field,
.select,
.toolbar-btn {
  transition:
    background var(--aimd-duration-fast) var(--aimd-ease-in-out),
    border-color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    color var(--aimd-duration-fast) var(--aimd-ease-in-out),
    box-shadow var(--aimd-duration-fast) var(--aimd-ease-in-out);
}

.btn,
.icon-btn,
.segmented button,
.toolbar-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.btn {
  min-height: var(--aimd-size-control-action-panel);
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  border: 1px solid var(--aimd-border-default);
  background: var(--aimd-button-secondary-bg);
  color: var(--aimd-button-secondary-text);
  font-size: var(--aimd-button-label-size);
  font-weight: var(--aimd-font-medium);
}

.btn--primary {
  border-color: transparent;
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  font-weight: var(--aimd-font-semibold);
}

.btn--danger {
  color: var(--aimd-interactive-danger);
}

.btn:hover,
.segmented button:hover,
.toolbar-btn:hover {
  background: var(--aimd-button-secondary-hover);
}

.btn--primary:hover {
  background: var(--aimd-interactive-primary-hover);
}

.btn--danger:hover {
  background: var(--aimd-feedback-danger-bg);
}

.icon-btn,
.toolbar-btn {
  width: var(--aimd-size-control-icon-panel);
  height: var(--aimd-size-control-icon-panel);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-button-icon-text);
}

.icon-btn {
  border: 1px solid transparent;
  background: transparent;
}

.icon-btn:hover {
  background: var(--aimd-button-icon-hover);
  color: var(--aimd-button-icon-text-hover);
}

.aimd-icon,
.aimd-icon svg {
  width: var(--aimd-size-control-glyph-panel);
  height: var(--aimd-size-control-glyph-panel);
  display: block;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 160px;
  gap: var(--aimd-space-3);
}

.field,
.select {
  min-height: var(--aimd-size-control-action-panel);
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-primary);
  color: var(--aimd-text-primary);
  font: inherit;
  font-size: var(--aimd-text-sm);
}

.field {
  width: 100%;
  padding: 0 var(--aimd-space-3);
  outline: none;
}

.select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-2);
  padding: 0 var(--aimd-space-3);
}

.field:focus,
.select:focus-visible,
.btn:focus-visible,
.icon-btn:focus-visible,
.segmented button:focus-visible,
.toolbar-btn:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: 2px;
}

.segmented {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 3px;
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-full);
  background: var(--aimd-bg-secondary);
}

.segmented button {
  min-height: var(--aimd-size-control-compact);
  padding: 0 var(--aimd-space-3);
  border-radius: var(--aimd-radius-full);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
  font-weight: var(--aimd-font-medium);
}

.segmented button[data-active="1"] {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.toolbar {
  display: inline-flex;
  align-items: center;
  gap: var(--aimd-space-1);
  padding: var(--aimd-space-1);
  border: 1px solid color-mix(in srgb, var(--aimd-border-strong) 72%, transparent);
  border-radius: var(--aimd-radius-xl);
  background: color-mix(in srgb, var(--aimd-bg-surface) 97%, var(--aimd-bg-primary));
}

.toolbar-btn {
  width: var(--aimd-size-control-icon-toolbar);
  height: var(--aimd-size-control-icon-toolbar);
  border-radius: var(--aimd-radius-lg);
}

.toolbar-btn[data-active="1"] {
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
}

.surface-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: var(--aimd-space-3);
}

.panel-demo,
.dialog-demo,
.popover-demo,
.reader-card,
.bookmark-list {
  border: 1px solid var(--aimd-border-default);
  border-radius: var(--aimd-radius-2xl);
  background: var(--aimd-bg-surface);
  box-shadow: var(--aimd-shadow-sm);
  overflow: hidden;
}

.panel-demo__header,
.panel-demo__footer,
.dialog-demo__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-3) var(--aimd-space-4);
}

.panel-demo__header {
  border-bottom: 1px solid var(--aimd-border-default);
}

.panel-demo__body,
.dialog-demo__body,
.reader-card,
.bookmark-list {
  padding: var(--aimd-space-4);
}

.panel-demo__footer,
.dialog-demo__footer {
  border-top: 1px solid var(--aimd-border-default);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 72%, transparent);
}

.panel-title,
.dialog-title {
  margin: 0;
  font-size: var(--aimd-panel-title-size-compact);
  font-weight: var(--aimd-panel-title-weight);
  line-height: var(--aimd-panel-title-line-height);
}

.bookmark-list {
  display: grid;
  gap: var(--aimd-space-2);
}

.bookmark-row {
  display: grid;
  grid-template-columns: var(--aimd-size-control-glyph-panel) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2);
  border-radius: var(--aimd-radius-lg);
  color: var(--aimd-text-secondary);
}

.bookmark-row[data-selected="1"] {
  background: var(--aimd-interactive-selected);
  color: var(--aimd-interactive-primary);
}

.bookmark-row__title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--aimd-text-sm);
  font-weight: var(--aimd-font-medium);
}

.bookmark-row__meta {
  display: block;
  margin-top: 2px;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-xs);
}

.reader-card {
  display: grid;
  gap: var(--aimd-space-3);
}

.reader-card h3,
.reader-card p,
.reader-card pre {
  margin: 0;
}

.reader-card h3 {
  font-size: var(--aimd-text-lg);
  line-height: 1.35;
}

.reader-card p {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-base);
  line-height: var(--aimd-leading-reading);
}

.reader-card code,
.reader-card pre {
  font-family: var(--aimd-font-family-mono);
}

.reader-card pre {
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-primary);
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dialog-demo {
  display: grid;
}

.dialog-demo__body {
  display: grid;
  gap: var(--aimd-space-2);
}

.dialog-title {
  color: var(--aimd-text-primary);
}

.dialog-demo__message {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: var(--aimd-leading-normal);
}

.popover-demo {
  display: grid;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-3);
  border-radius: var(--aimd-radius-xl);
  box-shadow: var(--aimd-shadow-lg);
}

.state-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-bg-secondary);
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
}

.state-row[data-kind="success"] {
  border: 1px solid var(--aimd-state-success-border);
}

.state-row[data-kind="danger"] {
  border: 1px solid var(--aimd-state-error-border);
  color: var(--aimd-color-danger);
}

@media (max-width: 740px) {
  .showcase {
    padding: var(--aimd-space-4);
  }

  .palette-grid,
  .surface-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .showcase__header {
    display: grid;
  }
}
`;
}

function renderPalette(): string {
    return palette.map(([name, token]) => `
<article class="swatch">
  <span class="swatch__chip" style="--swatch: var(${token})"></span>
  <span>
    <span class="swatch__name">${name}</span>
    <span class="swatch__token">${token}</span>
  </span>
</article>
`).join('');
}

function renderShowcase(theme: Theme): string {
    return `
<article class="showcase" data-theme="${theme}">
  <header class="showcase__header">
    <div>
      <div class="showcase__eyebrow">AI-MarkDone design system</div>
      <h2 class="showcase__title">${theme === 'dark' ? 'Dark' : 'Light'} runtime tokens</h2>
      <p class="showcase__copy">A local baseline for token values, controls, panels, reader content, bookmark rows, dialogs, and transient surfaces.</p>
    </div>
    <span class="theme-pill">${icon(Icons.eye)} ${theme}</span>
  </header>

  <section class="section" aria-labelledby="${theme}-palette-title">
    <div class="section__head">
      <h3 class="section__title" id="${theme}-palette-title">Palette</h3>
      <span class="section__kicker">neutral + one accent + states</span>
    </div>
    <div class="palette-grid">${renderPalette()}</div>
  </section>

  <section class="section" aria-labelledby="${theme}-type-title">
    <div class="section__head">
      <h3 class="section__title" id="${theme}-type-title">Typography</h3>
      <span class="section__kicker">fixed scale, no viewport sizing</span>
    </div>
    <div class="type-stack">
      <div class="type-row type-row--title"><strong>Panel title / 18px semibold</strong><span class="type-spec">var(--aimd-panel-title-size), var(--aimd-font-semibold)</span></div>
      <div class="type-row type-row--body"><strong>Reader body / 14px, reading line-height</strong><span class="type-spec">var(--aimd-text-base), var(--aimd-leading-reading)</span></div>
      <div class="type-row type-row--label"><strong>Utility label / 12px medium</strong><span class="type-spec">var(--aimd-text-xs), var(--aimd-font-medium)</span></div>
    </div>
  </section>

  <section class="section" aria-labelledby="${theme}-controls-title">
    <div class="section__head">
      <h3 class="section__title" id="${theme}-controls-title">Controls</h3>
      <span class="section__kicker">buttons, fields, segmented state</span>
    </div>
    <div class="controls">
      <button class="btn btn--primary" type="button">${icon(Icons.bookOpen)} Reader</button>
      <button class="btn" type="button">${icon(Icons.bookmark)} Bookmark</button>
      <button class="btn btn--danger" type="button">${icon(Icons.trash)} Delete</button>
      <button class="icon-btn" type="button" aria-label="Search">${icon(Icons.search)}</button>
      <button class="icon-btn" type="button" aria-label="Close">${icon(Icons.x)}</button>
    </div>
    <div class="form-grid">
      <input class="field" value="Search saved conversations" aria-label="Example search" />
      <button class="select" type="button"><span>Markdown</span>${icon(Icons.chevronDown)}</button>
    </div>
    <div class="segmented" role="tablist" aria-label="Example mode">
      <button type="button" data-active="1">Reader</button>
      <button type="button">Bookmarks</button>
      <button type="button">Export</button>
    </div>
  </section>

  <section class="section" aria-labelledby="${theme}-surfaces-title">
    <div class="section__head">
      <h3 class="section__title" id="${theme}-surfaces-title">Surfaces</h3>
      <span class="section__kicker">panel + toolbar + content</span>
    </div>
    <div class="toolbar" aria-label="Toolbar sample">
      <button class="toolbar-btn" data-active="1" type="button" aria-label="Bookmark">${icon(Icons.bookmarkCheck)}</button>
      <button class="toolbar-btn" type="button" aria-label="Copy">${icon(Icons.copy)}</button>
      <button class="toolbar-btn" type="button" aria-label="Locate">${icon(Icons.locate)}</button>
    </div>
    <div class="surface-grid">
      <article class="panel-demo">
        <header class="panel-demo__header">
          <h4 class="panel-title">Bookmarks panel</h4>
          <button class="icon-btn" type="button" aria-label="Settings">${icon(Icons.settings)}</button>
        </header>
        <div class="panel-demo__body">
          <div class="bookmark-list">
            <div class="bookmark-row" data-selected="1">${icon(Icons.folderOpen)}<span><span class="bookmark-row__title">Product research</span><span class="bookmark-row__meta">12 saved turns</span></span><span class="meta">Active</span></div>
            <div class="bookmark-row">${icon(Icons.bookmark)}<span><span class="bookmark-row__title">Reader mode keeps source-aware copy stable</span><span class="bookmark-row__meta">ChatGPT · 4 min ago</span></span><span class="meta">Go</span></div>
            <div class="bookmark-row">${icon(Icons.bookmark)}<span><span class="bookmark-row__title">Export workflow with comments</span><span class="bookmark-row__meta">Claude · yesterday</span></span><span class="meta">Go</span></div>
          </div>
        </div>
        <footer class="panel-demo__footer">
          <span class="meta">3 selected surfaces</span>
          <button class="btn btn--primary" type="button">Export</button>
        </footer>
      </article>
      <article class="reader-card">
        <h3>Reader content</h3>
        <p>Readable long-form content uses a stable measure, semantic text colors, tokenized code blocks, and the reading line-height.</p>
        <pre><code>const sourceAwareCopy = true;</code></pre>
      </article>
    </div>
  </section>

  <section class="section" aria-labelledby="${theme}-transient-title">
    <div class="section__head">
      <h3 class="section__title" id="${theme}-transient-title">Dialog and popover</h3>
      <span class="section__kicker">layering, focus, state color</span>
    </div>
    <div class="surface-grid">
      <article class="dialog-demo">
        <div class="dialog-demo__body">
          <h4 class="dialog-title">Save selected messages?</h4>
          <p class="dialog-demo__message">Dialog surfaces use tokenized radius, shadow, border, and action states while preserving compact density.</p>
        </div>
        <footer class="dialog-demo__footer">
          <button class="btn" type="button">Cancel</button>
          <button class="btn btn--primary" type="button">Save</button>
        </footer>
      </article>
      <article class="popover-demo">
        <div class="state-row" data-kind="success"><span>Export ready</span><span>Success</span></div>
        <div class="state-row"><span>Hover action</span><span>Preview</span></div>
        <div class="state-row" data-kind="danger"><span>Delete bookmark</span><span>Danger</span></div>
      </article>
    </div>
  </section>
</article>
`;
}

export function mountDesignSystemShowcase(root: HTMLElement, themes: Theme[] = ['light', 'dark']): void {
    root.replaceChildren();
    for (const theme of themes) {
        const host = document.createElement('div');
        host.className = 'aimd-design-system-showcase-host';
        host.setAttribute('data-aimd-theme', theme);
        const shadow = host.attachShadow({ mode: 'open' });
        ensureStyle(shadow, getTokenCss(theme), { id: `aimd-design-system-tokens-${theme}` });
        ensureStyle(shadow, getShowcaseCss(), { id: 'aimd-design-system-showcase-base', cache: 'shared' });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = renderShowcase(theme);
        shadow.append(...Array.from(wrapper.childNodes));
        root.appendChild(host);
    }
}

const stage = document.getElementById('design-system-stage');
if (stage) {
    mountDesignSystemShowcase(stage);
}
