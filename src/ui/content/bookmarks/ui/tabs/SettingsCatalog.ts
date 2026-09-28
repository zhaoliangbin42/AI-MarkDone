import { createWorkspaceNavigationButton } from '../components/WorkspaceNavigationButton';
import { t } from '../../../components/i18n';
import { createIcon } from '../../../components/Icon';
import { sunIcon, bookOpenIcon, textCursorIcon, highlighterIcon, downloadIcon, keyboardIcon, databaseIcon, settingsIcon, searchIcon } from '../../../../../assets/workspaceIcons';

export const SETTINGS_CATEGORIES = [
    ['appearance', 'settingsCategoryAppearance', sunIcon],
    ['reading', 'settingsCategoryReading', bookOpenIcon],
    ['input', 'settingsCategoryInput', textCursorIcon],
    ['marks', 'settingsCategoryMarks', highlighterIcon],
    ['export', 'settingsCategoryExport', downloadIcon],
    ['controls', 'settingsCategoryControls', keyboardIcon],
    ['data', 'settingsCategoryData', databaseIcon],
    ['advanced', 'settingsCategoryAdvanced', settingsIcon],
] as const;
export type SettingsCategoryId = typeof SETTINGS_CATEGORIES[number][0];
const GROUP_ORDER = ['Interface', 'Page', 'Directory', 'Reader', 'Position', 'Editing', 'FormulaAssistant', 'Prompts', 'Marks', 'AnnotationOutput', 'Markdown', 'FormulaButtons', 'FormulaImages', 'MessageImages', 'MessageButtons', 'Selection', 'Drawer', 'Keyboard', 'Data', 'Advanced'].map(name => `settingsGroup${name}`);
const GROUP_HINT_KEYS: Record<string, string> = {
    settingsGroupFormulaButtons: 'settingsGroupFormulaButtonsHint',
    settingsGroupSelection: 'settingsGroupSelectionHint',
    settingsGroupDrawer: 'settingsGroupDrawerHint',
};

/** Reparents existing controls so category changes and search preserve field state. */
export class SettingsCatalog {
    readonly navigation = document.createElement('div');
    readonly header = document.createElement('header');
    readonly content = document.createElement('div');
    readonly search = document.createElement('input');
    private readonly title = document.createElement('h2');
    private readonly empty = document.createElement('p');
    private readonly sections = new Map<SettingsCategoryId, { root: HTMLElement; rows: HTMLElement[]; label: string }>();
    private active: SettingsCategoryId = 'appearance';
    constructor(groups: Record<SettingsCategoryId, HTMLElement[]>, onChange: () => void) {
        this.navigation.className = 'settings-category-navigation';
        this.navigation.addEventListener('aimd:settings-active', () => this.filter());
        this.header.className = 'settings-catalog-header';
        this.content.className = 'settings-catalog';
        this.search.type = 'search'; this.search.placeholder = t('settingsSearch'); this.search.setAttribute('aria-label', t('settingsSearch'));
        this.search.dataset.role = 'settings-search';
        const field = document.createElement('label'); field.className = 'search-field'; field.append(createIcon(searchIcon), this.search);
        this.header.append(field, this.title);
        for (const [id, key, icon] of SETTINGS_CATEGORIES) {
            const label = t(key);
            const button = createWorkspaceNavigationButton(label, icon, () => { this.active = id; this.search.value = ''; onChange(); this.filter(); this.navigation.dispatchEvent(new Event('aimd:settings-request', { bubbles: true })); });
            button.dataset.category = id;
            this.navigation.append(button);
            const section = document.createElement('section'); section.className = 'settings-catalog-section'; section.dataset.category = id;
            const heading = document.createElement('h3'); heading.textContent = label;
            section.append(heading);
            const subgroups = new Map<string, HTMLElement[]>();
            for (const row of groups[id]) {
                const key = row.dataset.settingsGroup ?? '';
                subgroups.set(key, [...(subgroups.get(key) ?? []), row]);
            }
            for (const [key, rows] of [...subgroups].sort(([left], [right]) => GROUP_ORDER.indexOf(left) - GROUP_ORDER.indexOf(right))) {
                const subgroup = document.createElement('section'); subgroup.className = 'settings-subgroup';
                if (key) {
                    const title = document.createElement('h4'); title.textContent = t(key); subgroup.append(title);
                    if (GROUP_HINT_KEYS[key]) {
                        const hint = document.createElement('p'); hint.className = 'settings-subgroup-hint'; hint.textContent = t(GROUP_HINT_KEYS[key]);
                        subgroup.append(hint);
                    }
                }
                const card = document.createElement('div'); card.className = 'settings-card'; card.append(...rows);
                subgroup.append(card); section.append(subgroup);
            }
            this.content.append(section);
            this.sections.set(id, { root: section, rows: groups[id], label });
        }
        this.empty.className = 'library-empty'; this.empty.textContent = t('libraryNoMatches'); this.content.append(this.empty);
        this.search.addEventListener('input', () => { onChange(); this.filter(); });
        this.filter();
    }
    private filter(): void {
        const query = this.search.value.trim().toLocaleLowerCase();
        const terms = query.split(/\s+/u).filter(Boolean);
        let found = false;
        for (const [id, group] of this.sections) {
            let visible = false;
            for (const row of group.rows) {
                const groupKey = row.dataset.settingsGroup ?? '';
                const hint = GROUP_HINT_KEYS[groupKey] ? t(GROUP_HINT_KEYS[groupKey]) : '';
                const searchableText = `${group.label} ${t(groupKey)} ${hint} ${row.textContent} ${row.querySelector('[data-role]')?.getAttribute('data-role') ?? ''}`.toLocaleLowerCase();
                row.hidden = terms.length ? !terms.every(term => searchableText.includes(term)) : id !== this.active;
                visible ||= !row.hidden;
            }
            for (const subgroup of group.root.querySelectorAll<HTMLElement>('.settings-subgroup')) {
                subgroup.hidden = !group.rows.some(row => subgroup.contains(row) && !row.hidden);
            }
            group.root.hidden = !visible; found ||= visible;
            group.root.querySelector('h3')!.hidden = !query;
        }
        this.title.textContent = query ? t('settingsSearchResults') : this.sections.get(this.active)!.label;
        this.empty.hidden = found;
        this.navigation.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
            const selected = !query && button.dataset.category === this.active;
            button.dataset.active = String(selected); button.setAttribute('aria-pressed', String(selected));
        });
    }
}
