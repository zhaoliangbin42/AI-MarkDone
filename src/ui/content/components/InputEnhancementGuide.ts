import { t } from './i18n';

export const INPUT_ENHANCEMENT_GUIDE_CSS = `
.input-enhancement-guide-content {
  display: grid;
  gap: var(--aimd-space-4);
  color: var(--aimd-text-primary);
}
.input-enhancement-guide-intro {
  margin: 0;
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-sm);
  line-height: var(--aimd-leading-reading);
}
.input-enhancement-guide-section {
  display: grid;
  gap: var(--aimd-space-2);
}
.input-enhancement-guide-section h3 {
  margin: 0;
  font-size: var(--aimd-font-size-sm);
  font-weight: var(--aimd-font-semibold);
}
.input-enhancement-guide-list {
  display: grid;
  gap: var(--aimd-space-2);
  margin: 0;
}
.input-enhancement-guide-row {
  display: grid;
  grid-template-columns: minmax(8em, auto) minmax(0, 1fr);
  align-items: start;
  gap: var(--aimd-space-3);
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-md);
  background: var(--aimd-bg-secondary);
}
.input-enhancement-guide-row dt,
.input-enhancement-guide-row dd { margin: 0; }
.input-enhancement-guide-row dd {
  color: var(--aimd-text-secondary);
  font-size: var(--aimd-font-size-xs);
  line-height: var(--aimd-leading-normal);
}
.input-enhancement-guide-row code,
.input-enhancement-guide-row kbd {
  color: var(--aimd-text-primary);
  font-family: var(--aimd-font-family-mono);
  font-size: var(--aimd-font-size-xs);
  white-space: nowrap;
}
@media (max-width: 520px) {
  .input-enhancement-guide-row { grid-template-columns: minmax(0, 1fr); }
}
`;

export function createInputEnhancementGuideContent(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'input-enhancement-guide-content';
    const intro = document.createElement('p');
    intro.className = 'input-enhancement-guide-intro';
    intro.textContent = t('chatgptInputEnhancementGuideIntro');
    root.append(
        intro,
        createSection('chatgptInputEnhancementGuideSyntaxTitle', [
            ['**bold**', 'chatgptInputEnhancementGuideBoldSyntax'],
            ['1. item', 'chatgptInputEnhancementGuideOrderedListSyntax'],
            ['- item', 'chatgptInputEnhancementGuideUnorderedListSyntax'],
            ['$x$', 'chatgptInputEnhancementGuideInlineFormulaSyntax'],
            ['$$x$$', 'chatgptInputEnhancementGuideDisplayFormulaSyntax'],
        ], 'code'),
        createSection('chatgptInputEnhancementGuideShortcutsTitle', [
            ['Cmd/Ctrl+B', 'chatgptInputEnhancementGuideBoldShortcut'],
            ['Enter', 'chatgptInputEnhancementGuideEnterShortcut'],
            ['Shift+Enter', 'chatgptInputEnhancementGuideShiftEnterShortcut'],
            ['Cmd/Ctrl+Enter', 'chatgptInputEnhancementGuideSendShortcut'],
            ['↑ / ↓', 'chatgptInputEnhancementGuideFormulaNavigateShortcut'],
            ['Enter / Tab', 'chatgptInputEnhancementGuideFormulaAcceptShortcut'],
            ['Esc', 'chatgptInputEnhancementGuideFormulaDismissShortcut'],
        ], 'kbd'),
        createSection('chatgptInputEnhancementGuideEditingTitle', [
            ['Backspace', 'chatgptInputEnhancementGuideBackspaceBehavior'],
            ['\\', 'chatgptInputEnhancementGuideFormulaTrigger'],
        ], 'kbd'),
    );
    return root;
}

function createSection(
    titleKey: string,
    rows: Array<[string, string]>,
    marker: 'code' | 'kbd',
): HTMLElement {
    const section = document.createElement('section');
    section.className = 'input-enhancement-guide-section';
    const title = document.createElement('h3');
    title.textContent = t(titleKey);
    const list = document.createElement('dl');
    list.className = 'input-enhancement-guide-list';
    for (const [value, descriptionKey] of rows) {
        const row = document.createElement('div');
        row.className = 'input-enhancement-guide-row';
        const term = document.createElement('dt');
        const valueElement = document.createElement(marker);
        valueElement.textContent = value;
        term.appendChild(valueElement);
        const description = document.createElement('dd');
        description.textContent = t(descriptionKey);
        row.append(term, description);
        list.appendChild(row);
    }
    section.append(title, list);
    return section;
}
