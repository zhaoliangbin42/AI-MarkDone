export type ComposerSuggestionListItem = {
    title: string;
    content: string;
    trailing?: string;
};

export const COMPOSER_SUGGESTION_LIST_CSS = `
.composer-suggestion-list {
  display: grid;
  gap: var(--aimd-space-1);
  min-height: 0;
  max-height: min(280px, calc(100vh - var(--aimd-space-12)));
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--aimd-space-2);
}
.composer-suggestion-row {
  all: unset;
  box-sizing: border-box;
  min-width: 0;
  cursor: pointer;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--aimd-space-2);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  color: var(--aimd-text-primary);
}
.composer-suggestion-row:hover,
.composer-suggestion-row.is-active {
  background: var(--aimd-button-icon-hover);
}
.composer-suggestion-row:focus-visible {
  outline: 2px solid var(--aimd-focus-ring);
  outline-offset: -2px;
}
.composer-suggestion-row__main {
  min-width: 0;
}
.composer-suggestion-row__title,
.composer-suggestion-row__content {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.composer-suggestion-row__title {
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-semibold);
  font-family: var(--aimd-font-family-mono);
}
.composer-suggestion-row__content,
.composer-suggestion-row__trailing {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
}
.composer-suggestion-row__trailing {
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;

export function renderComposerSuggestionList(params: {
    root: HTMLElement;
    items: readonly ComposerSuggestionListItem[];
    selectedIndex: number;
    role: string;
    rowClassName?: string;
    mainClassName?: string;
    titleClassName?: string;
    contentClassName?: string;
    trailingClassName?: string;
    onHover: (index: number) => void;
    onSelect: (index: number) => void;
}): HTMLElement {
    const list = document.createElement('div');
    list.className = 'composer-suggestion-list';
    list.setAttribute('role', 'listbox');
    params.items.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = [
            'composer-suggestion-row',
            params.rowClassName ?? '',
            index === params.selectedIndex ? 'is-active' : '',
        ].filter(Boolean).join(' ');
        button.dataset.role = params.role;
        button.dataset.index = String(index);
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', index === params.selectedIndex ? 'true' : 'false');

        const main = document.createElement('span');
        main.className = ['composer-suggestion-row__main', params.mainClassName ?? ''].filter(Boolean).join(' ');
        const title = document.createElement('span');
        title.className = ['composer-suggestion-row__title', params.titleClassName ?? ''].filter(Boolean).join(' ');
        title.textContent = item.title;
        const content = document.createElement('span');
        content.className = ['composer-suggestion-row__content', params.contentClassName ?? ''].filter(Boolean).join(' ');
        content.textContent = item.content;
        main.append(title, content);
        button.appendChild(main);
        if (item.trailing) {
            const trailing = document.createElement('span');
            trailing.className = ['composer-suggestion-row__trailing', params.trailingClassName ?? ''].filter(Boolean).join(' ');
            trailing.textContent = item.trailing;
            button.appendChild(trailing);
        }
        button.addEventListener('mouseenter', () => params.onHover(index));
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', () => params.onSelect(index));
        list.appendChild(button);
    });
    params.root.appendChild(list);
    return list;
}
