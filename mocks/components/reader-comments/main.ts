import '../browserExtensionMock';
import katexCssUrl from 'katex/dist/katex.min.css?url';

import { messageSquareTextIcon } from '../../../src/assets/icons';
import { createIcon } from '../../../src/ui/content/components/Icon';
import { getMarkdownThemeCss } from '../../../src/services/renderer/markdownTheme';
import { ReaderCommentPopover } from '../../../src/ui/content/reader/ReaderCommentPopover';
import { ReaderCommentListPopover } from '../../../src/ui/content/reader/ReaderCommentListPopover';
import { ModalHost } from '../../../src/ui/content/components/ModalHost';
import { renderMarkdownForReader, type ReaderAtomicUnit } from '../../../src/services/renderer/renderMarkdown';
import {
    annotateRenderedAtomicUnits,
    resolveReaderSelectionRange,
    resolveSelectedAtomicUnits,
    type SelectedAtomicUnit,
} from '../../../src/services/reader/atomicSelection';
import {
    createReaderCommentRecord,
    resolveReaderCommentAnchor,
    resolveSelectionLayout,
    type ReaderCommentRect,
} from '../../../src/services/reader/commentAnchoring';
import { clearReaderCommentScope, listReaderComments, removeReaderComment, saveReaderComment, type ReaderCommentRecord } from '../../../src/services/reader/commentSession';
import { ensureStyle } from '../../../src/style/shadow';
import { getTokenCss } from '../../../src/style/tokens';
import { createAppearanceSnapshot } from '../../../src/style/appearance';
import {
    installVisualHarnessBridge,
    type VisualHarnessVariant,
} from '../visualHarnessBridge';

type Theme = 'light' | 'dark';

type MockItem = {
    id: string;
    title: string;
    markdown: string;
};

type SelectionState = {
    range: Range | null;
    selectedUnits: SelectedAtomicUnit[];
    selectedText: string;
};

type FrozenSelectionState = {
    range: Range;
    selectedUnits: SelectedAtomicUnit[];
    selectedText: string;
};

type CommentPromptState = {
    userPrompt: string;
    prompt1: string;
    prompt2: string;
    prompt3: string;
};

const SCOPE_ID = 'mock-reader-comments-v1';

const items: MockItem[] = [
    {
        id: 'paper-1',
        title: 'Dense mixed paragraph selection',
        markdown: [
            '# Reader Comment Prototype',
            '',
            '这是一段较长的论文式说明文本，里面故意混排了 **粗体强调**、*斜体说明*、`inline code`、[链接](https://example.com) 和行内公式 $x_1 + y_1$，目的是确认你在真实阅读场景里拖选内容时，普通文字仍然保持浏览器原生高亮，但 comment 功能能够在选区上方出现入口，并且对混合内容进行稳定评论。',
            '',
            '第二段继续增加复杂度：这里同时出现另一个公式 $\\alpha + \\beta$、一个列表和一张图片，用来观察评论锚点是否还能保持在合适的地方，以及右侧 comment 按钮是否足够贴近正文而不显得喧宾夺主。',
            '',
            '- 列表项一包含 `config.mode = "reader"` 和公式 $p_i$',
            '- 列表项二只有普通文字和一个 [链接按钮](https://openai.com)',
            '',
            '> 引用块里也混排了一点正文和公式 $z^2$，但评论系统本身不应该把整个引用块都变成 atomic 单元。',
            '',
            '![Signal flow](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80)',
            '',
            '| 指标 | 数值 |',
            '| --- | --- |',
            '| Recall | 0.91 |',
            '| F1 | 0.88 |',
            '',
            '$$',
            '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
            '$$',
            '',
            '```ts',
            'const answer = 42;',
            'function square(value: number) {',
            '  return value * value;',
            '}',
            '```',
        ].join('\n'),
    },
];

function getCommentsMockCss(): string {
    return `
:host {
  display: block;
  min-width: 0;
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-sans);
}
*, *::before, *::after { box-sizing: border-box; }

.mock-shell {
  min-width: 0;
  max-width: 100%;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 68%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 95%, transparent);
  box-shadow: 0 26px 80px color-mix(in srgb, var(--aimd-overlay-bg) 18%, transparent);
  overflow: hidden;
}

.mock-header,
.mock-footer {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
}

.mock-header {
  border-bottom: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 85%, transparent);
}

.mock-footer {
  border-top: 1px solid color-mix(in srgb, var(--aimd-border-subtle) 85%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 42%, transparent);
}

.mock-header__meta,
.mock-footer__status {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.mock-header__title {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  font-weight: var(--aimd-font-semibold);
}

.mock-header__hint,
.mock-footer__status {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-text-sm);
  line-height: 1.5;
}

.mock-actions {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.mock-btn {
  min-width: 96px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 80%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-secondary) 78%, transparent);
  color: var(--aimd-text-primary);
  font: inherit;
  cursor: pointer;
}

.mock-btn:hover {
  background: color-mix(in srgb, var(--aimd-bg-secondary) 92%, var(--aimd-interactive-hover));
}

.mock-btn--primary {
  border-color: color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 92%, var(--aimd-bg-primary));
}

.reader-stage {
  min-width: 0;
  position: relative;
  padding: 22px;
}

.reader-markdown {
  min-width: 0;
  min-height: 260px;
  max-width: 840px;
}

.reader-markdown :where(p, ul, ol, dl, table, blockquote, pre, hr) {
  margin-bottom: 0.8em;
}

${getMarkdownThemeCss('.reader-markdown')}

.reader-comment-overlay {
  position: absolute;
  inset: 22px 22px 22px 22px;
  pointer-events: none;
}

.reader-comment-highlight {
  position: absolute;
  background: color-mix(in srgb, var(--aimd-interactive-selected) 90%, var(--aimd-bg-primary));
  opacity: 0.98;
}

.reader-comment-action,
.reader-comment-anchor {
  position: absolute;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--aimd-interactive-primary) 42%, transparent);
  background: color-mix(in srgb, var(--aimd-interactive-selected) 94%, var(--aimd-bg-primary));
  color: var(--aimd-text-primary);
  font: inherit;
  font-size: var(--aimd-text-sm);
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
}

.reader-comment-action .aimd-icon,
.reader-comment-anchor .aimd-icon {
  color: var(--aimd-interactive-primary);
}

.reader-comment-anchor {
  width: 32px;
  padding: 0;
}

.reader-comment-anchor[data-count]::after {
  content: attr(data-count);
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  font-size: 11px;
  line-height: 1;
}

.mock-output {
  min-width: 0;
  max-width: 100%;
  margin: 0;
  padding: 14px 16px;
  min-height: 80px;
  border-radius: var(--aimd-radius-xl);
  border: 1px solid color-mix(in srgb, var(--aimd-border-default) 78%, transparent);
  background: color-mix(in srgb, var(--aimd-bg-primary) 92%, transparent);
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-text-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 560px) {
  .mock-header,
  .mock-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .mock-actions { width: 100%; }
  .mock-btn {
    min-width: 0;
    flex: 1 1 0;
  }

  .reader-stage { padding: 16px; }
  .reader-comment-overlay { inset: 16px; }
  .mock-output { width: 100%; }
}
`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function installTransientButtonBoundary(button: HTMLButtonElement): void {
    const swallow = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
    };
    button.addEventListener('pointerdown', swallow);
    button.addEventListener('pointerup', swallow);
    button.addEventListener('mouseup', swallow);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function freezeSelectionState(selection: SelectionState): FrozenSelectionState | null {
    if (!selection.range) return null;
    return {
        range: selection.range.cloneRange(),
        selectedUnits: [...selection.selectedUnits],
        selectedText: selection.selectedText,
    };
}

function buildCommentsExport(comments: ReaderCommentRecord[], prompts: CommentPromptState): string {
    const lines = comments.map((record, index) => (
        `${index + 1}. ${prompts.prompt1}${record.sourceMarkdown}${prompts.prompt2}${record.comment}${prompts.prompt3}`
    ));

    if (prompts.userPrompt.trim()) {
        return [prompts.userPrompt.trim(), ...lines].join('\n');
    }

    return lines.join('\n');
}

class ReaderCommentsMock {
    private shadow: ShadowRoot | null = null;
    private markdownRoot: HTMLElement | null = null;
    private overlayRoot: HTMLElement | null = null;
    private renderedAtomicUnits: ReaderAtomicUnit[] = [];
    private selectedUnits: SelectedAtomicUnit[] = [];
    private selectionRange: Range | null = null;
    private commentPopover = new ReaderCommentPopover();
    private commentListPopover = new ReaderCommentListPopover();
    private modalHost: ModalHost | null = null;
    private commentSortMode: 'created' | 'position' = 'created';
    private visible = true;
    private theme: Theme = 'light';
    private readonly scopeId = SCOPE_ID;
    private prompts: CommentPromptState = {
        userPrompt: '请基于以下逐条评论，整理出结构化反馈：',
        prompt1: '针对',
        prompt2: '，我的评价是：',
        prompt3: '',
    };
    private copyFeedback = '';

    constructor(private readonly mountPoint: HTMLElement, private readonly item: MockItem) {}

    init(): void {
        this.renderOuterShell();
        this.mountReader();
    }

    setTheme(theme: Theme): void {
        this.theme = theme;
        this.commentPopover.setAppearance(createAppearanceSnapshot(theme));
        if (!this.shadow) return;

        ensureStyle(this.shadow, getTokenCss(theme), { id: 'aimd-reader-comments-tokens' });
        if (this.shadow.host instanceof HTMLElement) {
            this.shadow.host.dataset.aimdTheme = theme;
        }
    }

    private renderOuterShell(): void {
        this.mountPoint.innerHTML = `
          <section class="card">
            <div class="mock-actions">
              <button class="toggle-reader" type="button">${this.visible ? 'Close reader' : 'Open reader'}</button>
            </div>
            <div class="comment-export-controls">
              <label class="comment-export-field">
                <span>User prompt</span>
                <textarea data-role="user-prompt" rows="3" placeholder="Add the top-level instruction...">${escapeHtml(this.prompts.userPrompt)}</textarea>
              </label>
              <label class="comment-export-field">
                <span>Prompt 1</span>
                <input data-role="prompt-1" type="text" value="${escapeHtml(this.prompts.prompt1)}" />
              </label>
              <label class="comment-export-field">
                <span>Prompt 2</span>
                <input data-role="prompt-2" type="text" value="${escapeHtml(this.prompts.prompt2)}" />
              </label>
              <label class="comment-export-field">
                <span>Prompt 3</span>
                <input data-role="prompt-3" type="text" value="${escapeHtml(this.prompts.prompt3)}" />
              </label>
              <div class="mock-actions">
                <button class="copy-comments" type="button">Copy comments</button>
              </div>
            </div>
          </section>
          <div class="reader-comments-host"></div>
        `;
        this.mountPoint.querySelector<HTMLButtonElement>('.toggle-reader')?.addEventListener('click', () => {
            this.visible ? this.unmountReader() : this.mountReader();
        });
        this.mountPoint.querySelector<HTMLTextAreaElement>('[data-role="user-prompt"]')?.addEventListener('input', (event) => {
            this.prompts.userPrompt = (event.currentTarget as HTMLTextAreaElement).value;
            this.renderComments();
        });
        this.mountPoint.querySelector<HTMLInputElement>('[data-role="prompt-1"]')?.addEventListener('input', (event) => {
            this.prompts.prompt1 = (event.currentTarget as HTMLInputElement).value;
            this.renderComments();
        });
        this.mountPoint.querySelector<HTMLInputElement>('[data-role="prompt-2"]')?.addEventListener('input', (event) => {
            this.prompts.prompt2 = (event.currentTarget as HTMLInputElement).value;
            this.renderComments();
        });
        this.mountPoint.querySelector<HTMLInputElement>('[data-role="prompt-3"]')?.addEventListener('input', (event) => {
            this.prompts.prompt3 = (event.currentTarget as HTMLInputElement).value;
            this.renderComments();
        });
        this.mountPoint.querySelector<HTMLButtonElement>('.copy-comments')?.addEventListener('click', async () => {
            const comments = listReaderComments(this.scopeId, this.item.id);
            const compiled = buildCommentsExport(comments, this.prompts);
            if (!compiled.trim()) {
                this.copyFeedback = 'No comments to copy yet.';
                this.renderComments();
                return;
            }

            try {
                await navigator.clipboard.writeText(compiled);
                this.copyFeedback = 'Copied compiled comments.';
            } catch {
                this.copyFeedback = 'Clipboard write failed in this browser context.';
            }
            this.renderComments();
        });
    }

    private ensureMockShell(): ShadowRoot {
        const host = this.mountPoint.querySelector<HTMLElement>('.reader-comments-host')!;
        host.innerHTML = '';
        const shadowHost = document.createElement('div');
        shadowHost.className = 'reader-comments-mock-host';
        shadowHost.dataset.aimdTheme = this.theme;
        host.appendChild(shadowHost);
        const shadow = shadowHost.attachShadow({ mode: 'open' });
        ensureStyle(shadow, getTokenCss(this.theme), { id: 'aimd-reader-comments-tokens' });
        ensureStyle(shadow, getCommentsMockCss(), { id: 'aimd-reader-comments-base', cache: 'shared' });
        const katex = document.createElement('link');
        katex.rel = 'stylesheet';
        katex.href = katexCssUrl;
        shadow.appendChild(katex);
        return shadow;
    }

    private mountReader(): void {
        this.visible = true;
        this.mountPoint.querySelector<HTMLButtonElement>('.toggle-reader')!.textContent = 'Close reader';

        this.shadow = this.ensureMockShell();
        this.commentPopover.setAppearance(createAppearanceSnapshot(this.theme));

        const content = document.createElement('template');
        content.innerHTML = `
          <article class="mock-shell" data-role="mock-shell">
            <header class="mock-header">
              <div class="mock-header__meta">
                <h2 class="mock-header__title">${escapeHtml(this.item.title)}</h2>
                <p class="mock-header__hint">Select content, click Comment, save, then close and reopen the reader to verify page-level persistence.</p>
              </div>
              <div class="mock-actions">
                <button class="mock-btn list-comments" type="button">Annotations</button>
                <button class="mock-btn clear-comments" type="button">Clear comments</button>
              </div>
            </header>
            <section class="reader-stage" data-role="reader-stage">
              <div class="reader-markdown" data-role="reader-markdown"></div>
              <div class="reader-comment-overlay" data-role="comment-overlay"></div>
            </section>
            <footer class="mock-footer">
              <div class="mock-footer__status" data-role="selection-status"></div>
              <pre class="mock-output" data-role="comments-preview"></pre>
            </footer>
          </article>
        `;
        this.shadow.appendChild(content.content.cloneNode(true));

        this.modalHost = new ModalHost(this.shadow);

        this.markdownRoot = this.shadow.querySelector<HTMLElement>('[data-role="reader-markdown"]');
        this.overlayRoot = this.shadow.querySelector<HTMLElement>('[data-role="comment-overlay"]');
        this.shadow.querySelector<HTMLButtonElement>('.clear-comments')?.addEventListener('click', () => {
            clearReaderCommentScope(this.scopeId);
            this.renderComments();
        });
        this.shadow.querySelector<HTMLButtonElement>('.list-comments')?.addEventListener('click', () => this.openCommentList());

        this.renderMarkdown();
        document.addEventListener('selectionchange', this.onSelectionChange);
        document.addEventListener('pointerup', this.onSelectionChange);
    }

    private unmountReader(): void {
        this.visible = false;
        this.mountPoint.querySelector<HTMLButtonElement>('.toggle-reader')!.textContent = 'Open reader';
        if (this.shadow) {
            this.commentPopover.destroy();
            this.commentListPopover.close();
        }
        document.removeEventListener('selectionchange', this.onSelectionChange);
        document.removeEventListener('pointerup', this.onSelectionChange);
        this.mountPoint.querySelector<HTMLElement>('.reader-comments-host')!.innerHTML = '';
        this.shadow = null;
        this.markdownRoot = null;
        this.overlayRoot = null;
        this.modalHost = null;
        this.selectionRange = null;
        this.selectedUnits = [];
    }

    private readonly onSelectionChange = () => {
        if (!this.shadow || !this.markdownRoot || !this.overlayRoot) return;
        this.syncSelection();
    };

    private renderMarkdown(): void {
        if (!this.markdownRoot) return;
        const rendered = renderMarkdownForReader(this.item.markdown, { highlightCode: true });
        this.markdownRoot.innerHTML = rendered.html;
        this.renderedAtomicUnits = rendered.atomicUnits;
        annotateRenderedAtomicUnits(this.markdownRoot, rendered.atomicUnits);
        this.renderComments();
        this.syncSelection();
    }

    private syncSelection(): void {
        if (!this.shadow || !this.markdownRoot || !this.overlayRoot) return;
        const selection = window.getSelection();
        const range = resolveReaderSelectionRange(selection, this.shadow, this.markdownRoot);
        const selectedUnits = range ? resolveSelectedAtomicUnits(range, this.markdownRoot) : [];
        const selectedText = selection?.toString().trim() ?? '';
        const hasSelection = Boolean(range) && (selectedText.length > 0 || selectedUnits.length > 0);

        this.selectionRange = hasSelection ? range : null;
        this.selectedUnits = hasSelection ? selectedUnits : [];

        this.renderComments(hasSelection ? { range, selectedUnits, selectedText } : undefined);
    }

    private renderComments(currentSelection?: SelectionState): void {
        if (!this.overlayRoot || !this.markdownRoot || !this.shadow) return;
        this.overlayRoot.innerHTML = '';

        const comments = listReaderComments(this.scopeId, this.item.id);
        const listButton = this.shadow.querySelector<HTMLButtonElement>('.list-comments');
        if (listButton) listButton.disabled = comments.length < 1;
        const occupiedAnchorTops: number[] = [];
        for (const record of comments) {
            const resolved = resolveReaderCommentAnchor(this.markdownRoot, record);
            resolved.rects.forEach((rect) => {
                this.overlayRoot!.appendChild(this.createHighlight(rect));
            });
            if (!resolved.unionRect) continue;

            const anchor = this.createAnchorButton(record, resolved.unionRect, occupiedAnchorTops);
            this.overlayRoot.appendChild(anchor);
        }

        if (currentSelection && currentSelection.range && !this.commentPopover.isOpen()) {
            const resolved = resolveSelectionLayout({
                root: this.markdownRoot,
                range: currentSelection.range,
                selectedUnits: currentSelection.selectedUnits,
            });
            if (resolved.unionRect) {
                this.overlayRoot.appendChild(this.createCommentAction(resolved.unionRect, currentSelection));
            }
        }

        this.syncStatus(currentSelection, comments);
    }

    private openCommentList(): void {
        if (!this.shadow || !this.modalHost) return;
        const comments = listReaderComments(this.scopeId, this.item.id, this.commentSortMode);
        if (comments.length < 1) return;
        this.commentListPopover.open({
            shadow: this.shadow,
            modalHost: this.modalHost,
            comments,
            sortMode: this.commentSortMode,
            labels: {
                title: 'Annotations',
                close: 'Close',
                empty: 'No annotations yet.',
                sortByCreated: 'Creation time',
                sortByPosition: 'Text position',
                selectedSource: 'Selected content',
                userComment: 'Annotation',
                createdAt: 'Created',
                textPosition: 'Position',
                delete: 'Delete',
            },
            onSortChange: (sortMode) => {
                this.commentSortMode = sortMode;
            },
            onSelect: (record) => {
                this.openCommentPopover({
                    mode: 'edit',
                    initialText: record.comment,
                    selectedSource: record.sourceMarkdown,
                    onSave: (value) => {
                        saveReaderComment(this.scopeId, { ...record, comment: value, updatedAt: Date.now() });
                        this.renderComments();
                    },
                });
            },
            onDelete: (record) => {
                removeReaderComment(this.scopeId, record.itemId, record.id);
                this.commentListPopover.update({
                    comments: listReaderComments(this.scopeId, this.item.id, this.commentSortMode),
                    sortMode: this.commentSortMode,
                });
                this.renderComments();
            },
        });
    }

    private createHighlight(rect: ReaderCommentRect): HTMLElement {
        const element = document.createElement('div');
        element.className = 'reader-comment-highlight';
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.top}px`;
        element.style.width = `${rect.width}px`;
        element.style.height = `${rect.height}px`;
        return element;
    }

    private createCommentAction(unionRect: ReaderCommentRect, selection: SelectionState): HTMLElement {
        const button = document.createElement('button');
        button.className = 'reader-comment-action';
        button.type = 'button';
        button.innerHTML = `${createIcon(messageSquareTextIcon).outerHTML}<span>Comment</span>`;
        button.style.left = `${clamp(unionRect.left + unionRect.width / 2 - 54, 0, Math.max(0, this.overlayRoot!.clientWidth - 108))}px`;
        button.style.top = `${Math.max(0, unionRect.top - 40)}px`;
        installTransientButtonBoundary(button);
        button.addEventListener('click', () => {
            const frozenSelection = freezeSelectionState(selection);
            if (!frozenSelection || !this.markdownRoot) return;
            this.openCommentPopover({
                mode: 'create',
                initialText: '',
                anchorRect: button.getBoundingClientRect(),
                selectedSource: frozenSelection.selectedText,
                onSave: (value) => {
                    const record = createReaderCommentRecord({
                        id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        itemId: this.item.id,
                        comment: value,
                        range: frozenSelection.range,
                        root: this.markdownRoot,
                        selectedUnits: frozenSelection.selectedUnits,
                    });
                    saveReaderComment(this.scopeId, record);
                    this.renderComments();
                },
                selectionState: frozenSelection,
            });
        });
        return button;
    }

    private createAnchorButton(record: ReaderCommentRecord, unionRect: ReaderCommentRect, occupiedAnchorTops: number[]): HTMLElement {
        const button = document.createElement('button');
        button.className = 'reader-comment-anchor';
        button.type = 'button';
        button.innerHTML = createIcon(messageSquareTextIcon).outerHTML;
        button.setAttribute('data-count', '1');

        let top = unionRect.top + unionRect.height / 2 - 16;
        while (occupiedAnchorTops.some((value) => Math.abs(value - top) < 36)) top += 28;
        occupiedAnchorTops.push(top);

        const resolved = resolveReaderCommentAnchor(this.markdownRoot!, record);
        const centerY = top + 16;
        const anchorRect = resolved.rects.find((rect) => centerY >= rect.top && centerY <= rect.top + rect.height)
            ?? resolved.rects.reduce<ReaderCommentRect | null>((closest, rect) => {
                if (!closest) return rect;
                const closestDistance = Math.abs((closest.top + closest.height / 2) - centerY);
                const nextDistance = Math.abs((rect.top + rect.height / 2) - centerY);
                return nextDistance < closestDistance ? rect : closest;
            }, null)
            ?? unionRect;
        const overlayRect = this.overlayRoot!.getBoundingClientRect();
        const markdownRect = this.markdownRoot!.getBoundingClientRect();
        const gutterLeft = markdownRect.right - overlayRect.left + 16;
        const anchorLeft = Math.max(0, Math.min(
            this.overlayRoot!.clientWidth - 32,
            gutterLeft,
        ));

        button.style.left = `${anchorLeft}px`;
        button.style.top = `${Math.max(0, top)}px`;
        installTransientButtonBoundary(button);
        button.addEventListener('click', () => {
            this.openCommentPopover({
                mode: 'edit',
                initialText: record.comment,
                anchorRect: button.getBoundingClientRect(),
                selectedSource: record.sourceMarkdown,
                onSave: (value) => {
                    saveReaderComment(this.scopeId, {
                        ...record,
                        comment: value,
                        updatedAt: Date.now(),
                    });
                    this.renderComments();
                },
            });
        });
        return button;
    }

    private openCommentPopover(params: {
        mode: 'create' | 'edit';
        initialText: string;
        anchorRect?: DOMRect;
        selectedSource: string;
        onSave: (value: string) => void;
        selectionState?: FrozenSelectionState;
    }): void {
        if (!this.shadow) return;
        const shell = this.shadow.querySelector<HTMLElement>('[data-role="mock-shell"]');
        if (!shell) return;
        const shellRect = shell.getBoundingClientRect();
        const anchorRect = params.anchorRect ?? {
            left: shellRect.left + shellRect.width / 2,
            top: shellRect.top + Math.min(shellRect.height / 3, 180),
            width: 1,
            height: 1,
            right: shellRect.left + shellRect.width / 2 + 1,
            bottom: shellRect.top + Math.min(shellRect.height / 3, 180) + 1,
        };
        const zh = document.documentElement.lang === 'zh-CN';

        this.commentPopover.open({
            shadow: this.shadow,
            container: shell,
            appearance: createAppearanceSnapshot(this.theme),
            anchorRect,
            selectedSource: params.selectedSource,
            initialText: params.initialText,
            mode: params.mode,
            labels: zh ? {
                addTitle: '添加评论',
                editTitle: '编辑评论',
                close: '关闭',
                selectedSource: '所选内容',
                placeholder: '写下你的批注…',
                cancel: '取消',
                delete: '删除',
                save: '保存批注',
            } : undefined,
            onSave: (value) => params.onSave(value),
            onCancel: () => this.renderComments(this.selectionRange ? {
                range: this.selectionRange,
                selectedUnits: this.selectedUnits,
                selectedText: window.getSelection()?.toString().trim() ?? '',
            } : params.selectionState),
        });
    }

    prepareForAudit(): void {
        const zh = document.documentElement.lang === 'zh-CN';
        this.openCommentPopover({
            mode: 'create',
            initialText: zh ? '这里是一段用于检查长文案与短视口布局的批注。' : 'A concise annotation for long-copy and short-viewport checks.',
            selectedSource: zh
                ? '这是被选中的长段落，用来验证评论弹层在窄屏、深浅主题和缩放后的可读性。'
                : 'A longer selected passage used to verify the anchored comment surface across narrow layouts, themes, and zoom.',
            onSave: () => undefined,
        });
    }

    private syncStatus(currentSelection: SelectionState | undefined, comments: ReaderCommentRecord[]): void {
        if (!this.shadow) return;
        const status = this.shadow.querySelector<HTMLElement>('[data-role="selection-status"]');
        const preview = this.shadow.querySelector<HTMLElement>('[data-role="comments-preview"]');
        if (!status || !preview) return;
        const compiled = buildCommentsExport(comments, this.prompts);
        const copyButton = this.mountPoint.querySelector<HTMLButtonElement>('.copy-comments');
        if (copyButton) copyButton.disabled = comments.length < 1;

        status.innerHTML = `
          <strong>Current selection</strong>
          <span>${escapeHtml(currentSelection?.selectedText || 'none')}</span>
          <strong>Comments in memory</strong>
          <span>${comments.length}</span>
          <strong>Copy status</strong>
          <span>${escapeHtml(this.copyFeedback || 'Ready')}</span>
        `;

        preview.textContent = compiled || 'No comments yet.';
    }
}

const readerMocks: ReaderCommentsMock[] = [];

function mount(): void {
    const stage = document.querySelector<HTMLElement>('#reader-comments-stage');
    if (!stage) return;
    items.forEach((item) => {
        const mountPoint = document.createElement('section');
        mountPoint.className = 'stage';
        stage.appendChild(mountPoint);
        const readerMock = new ReaderCommentsMock(mountPoint, item);
        readerMocks.push(readerMock);
        readerMock.init();
    });
}

mount();

let visualVariant: VisualHarnessVariant = { theme: 'light', locale: 'en' };

function applyVisualVariant(variant: VisualHarnessVariant): void {
    visualVariant = variant;
    document.documentElement.dataset.aimdTheme = variant.theme;
    document.documentElement.dataset.theme = variant.theme;
    document.documentElement.lang = variant.locale === 'zh_CN' ? 'zh-CN' : 'en';
    document.body.dataset.theme = variant.theme;
    readerMocks.forEach((readerMock) => readerMock.setTheme(variant.theme));
    const title = document.querySelector('h1');
    if (title) title.textContent = variant.locale === 'zh_CN' ? '阅读器评论' : 'Reader Comments Mock';
}

installVisualHarnessBridge({
    applyVariant: applyVisualVariant,
    prepareForAudit: () => {
        readerMocks.forEach((readerMock, index) => {
            if (index === 0) readerMock.prepareForAudit();
        });
    },
    getState: () => ({
        ...visualVariant,
        expectedOpenSurfaces: [{ role: 'reader-comment-popover', count: 1 }],
        localeEvidence: document.querySelector('h1')?.textContent ?? '',
    }),
});
