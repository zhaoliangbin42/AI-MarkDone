import {
    getFeatureOverviewSections,
    type FeatureOverviewSettingsCategory,
} from '../../content/featureOverview';
import { createIcon } from '../../../components/Icon';
import { t } from '../../../components/i18n';
import { sigmaIcon } from '../../../../../assets/icons';
import {
    bookOpenIcon, outlineIcon, copyIcon, textCursorIcon,
    bookMarkedIcon, highlighterIcon, settingsIcon, searchIcon, chevronRightIcon,
} from '../../../../../assets/workspaceIcons';

const SECTION_ICONS: Readonly<Record<string, string>> = {
    reader: bookOpenIcon, navigation: outlineIcon, copyExport: copyIcon,
    input: textCursorIcon, formula: sigmaIcon, library: bookMarkedIcon,
    marks: highlighterIcon, settingsBackup: settingsIcon,
};

const CSS = `
.aimd-feature-overview { min-width: 0; width: 100%; color: var(--aimd-text-primary); container-type: inline-size; }
.features-panel { background: var(--aimd-bg-surface); }
.aimd-feature-overview .feature-overview-heading { margin: 0; font-size: calc(var(--aimd-text-xl) * 1.5); font-weight: var(--aimd-font-semibold); line-height: var(--aimd-leading-normal); }
.feature-overview-lead { margin: var(--aimd-space-2) 0 var(--aimd-space-5); color: var(--aimd-text-secondary); font-size: var(--aimd-text-base); line-height: var(--aimd-leading-reading); }
.feature-overview-search-row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--aimd-space-3); }
.feature-overview-search { flex: 1; min-width: 0; }
.feature-overview-count { flex: none; margin: 0; color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); font-variant-numeric: tabular-nums; }
.feature-overview-navigation { display: flex; flex-wrap: wrap; gap: var(--aimd-space-2); margin: var(--aimd-space-4) 0 var(--aimd-space-6); }
.feature-overview-jump { display: inline-flex; align-items: center; gap: var(--aimd-space-2); border: 1px solid var(--aimd-workspace-border); border-radius: var(--aimd-radius-lg); background: var(--aimd-workspace-card); padding: var(--aimd-space-2) var(--aimd-space-3); color: var(--aimd-text-secondary); font: inherit; font-size: var(--aimd-text-sm); cursor: pointer; }
.feature-overview-jump:hover, .feature-overview-jump:focus-visible { color: var(--aimd-interactive-primary); background: var(--aimd-interactive-selected); }
.feature-overview-section { margin-bottom: calc(var(--aimd-space-4) * 2); scroll-margin-block-start: var(--aimd-space-4); }
.feature-overview-section:focus { outline: none; }
.feature-overview-section-heading { display: flex; align-items: flex-start; gap: var(--aimd-space-3); margin-bottom: var(--aimd-space-3); padding: var(--aimd-space-4); border: 1px solid var(--aimd-border-subtle); border-radius: var(--aimd-radius-lg); background: var(--aimd-bg-secondary); }
.feature-overview-section-heading > .aimd-icon { color: var(--aimd-interactive-primary); width: var(--aimd-space-6); height: var(--aimd-space-6); flex: none; margin-top: var(--aimd-space-1); }
.feature-overview-section-title { flex: 1; min-width: 0; }
.feature-overview-section h3 { margin: 0; font-size: var(--aimd-text-lg); line-height: var(--aimd-leading-normal); font-weight: var(--aimd-font-semibold); }
.feature-overview-section-summary { margin: var(--aimd-space-1) 0 0; color: var(--aimd-text-secondary); font-size: var(--aimd-text-sm); line-height: var(--aimd-leading-reading); }
.feature-overview-settings { display: inline-flex; align-items: center; gap: var(--aimd-space-1); flex: none; border: none; border-radius: var(--aimd-radius-md); padding: var(--aimd-space-2); background: transparent; color: var(--aimd-interactive-primary); font: inherit; font-size: var(--aimd-text-xs); cursor: pointer; }
.feature-overview-settings:hover { background: var(--aimd-interactive-selected); }
.feature-overview-settings .aimd-icon { width: var(--aimd-space-4); height: var(--aimd-space-4); }
.feature-overview-table { width: 100%; table-layout: fixed; border-collapse: collapse; border-top: 1px solid var(--aimd-border-subtle); }
.feature-overview-function-column { width: 28%; }
.feature-overview-table th, .feature-overview-table td { min-width: 0; padding: var(--aimd-space-4) 0; vertical-align: top; text-align: start; border-bottom: 1px solid var(--aimd-border-subtle); overflow-wrap: anywhere; }
.feature-overview-table thead th { padding: var(--aimd-space-2) 0; color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); font-weight: var(--aimd-font-medium); }
.feature-overview-table th:first-child { padding-inline-end: var(--aimd-space-6); }
.feature-overview-item h4 { margin: 0; font-size: var(--aimd-text-base); font-weight: var(--aimd-font-semibold); line-height: var(--aimd-leading-normal); }
.feature-overview-description { margin: 0; color: var(--aimd-text-primary); font-size: var(--aimd-text-sm); line-height: var(--aimd-leading-reading); text-wrap: pretty; }
.feature-overview-entry { margin: var(--aimd-space-2) 0 0; color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); line-height: var(--aimd-leading-reading); text-wrap: pretty; }
.feature-overview-note { margin: var(--aimd-space-1) 0 0; color: var(--aimd-text-secondary); font-size: var(--aimd-text-xs); line-height: var(--aimd-leading-reading); overflow-wrap: anywhere; text-wrap: pretty; }
.feature-overview-shortcut { display: inline-block; margin-top: var(--aimd-space-2); padding: var(--aimd-space-1) var(--aimd-space-2); border: 1px solid var(--aimd-border-subtle); border-radius: var(--aimd-radius-md); background: var(--aimd-bg-surface); color: var(--aimd-text-secondary); font-family: var(--aimd-font-family-mono); font-size: var(--aimd-text-xs); line-height: var(--aimd-leading-label); }
.feature-overview-empty { padding: calc(var(--aimd-space-4) * 2) 0; text-align: center; color: var(--aimd-text-secondary); }
.feature-overview-empty p { margin: 0 0 var(--aimd-space-3); }
.aimd-feature-overview [hidden] { display: none; }
.feature-overview-jump:focus-visible, .feature-overview-settings:focus-visible { outline: 2px solid var(--aimd-focus-ring); outline-offset: 2px; }
@container (max-width: 720px) {
  .feature-overview-navigation { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; }
  .feature-overview-jump { flex: none; white-space: nowrap; }
  .feature-overview-section-heading { flex-wrap: wrap; }
  .feature-overview-settings { margin-inline-start: calc(var(--aimd-space-4) * 2); }
}
@container (max-width: 480px) {
  .feature-overview-function-column { width: 32%; }
  .feature-overview-table th:first-child { padding-inline-end: var(--aimd-space-3); }
}
@container (max-width: 240px) {
  .feature-overview-table, .feature-overview-table tbody, .feature-overview-table tr { display: block; }
  .feature-overview-table colgroup { display: none; }
  .feature-overview-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .feature-overview-table .feature-overview-item { padding: var(--aimd-space-4) 0; border-bottom: 1px solid var(--aimd-border-subtle); }
  .feature-overview-table tbody th, .feature-overview-table tbody td { display: block; width: 100%; padding: 0; border: none; }
  .feature-overview-table tbody td { padding-top: var(--aimd-space-2); }
}
@container (max-width: 360px) {
  .feature-overview-search { flex-basis: 100%; }
  .feature-overview-section-heading { display: grid; grid-template-columns: auto minmax(0, 1fr); }
  .feature-overview-settings { grid-column: 2; justify-self: start; margin-inline-start: 0; }
}
`;

type SectionNodes = {
    element: HTMLElement;
    jump: HTMLButtonElement;
    items: Array<{ element: HTMLElement; searchText: string }>;
};

/** Read-only feature guide; its only action is explicit navigation to Settings. */
export class FeatureOverviewTabView {
    private readonly root = document.createElement('div');
    private readonly search = document.createElement('input');
    private readonly count = document.createElement('p');
    private readonly empty = document.createElement('div');
    private readonly sections: SectionNodes[] = [];

    constructor(params: { onOpenSettings?: (category: FeatureOverviewSettingsCategory) => void } = {}) {
        this.root.className = 'aimd-feature-overview';
        const style = document.createElement('style');
        style.textContent = CSS;
        const heading = document.createElement('h2');
        heading.className = 'feature-overview-heading';
        heading.textContent = t('featureOverviewTitle');
        const lead = document.createElement('p');
        lead.className = 'feature-overview-lead';
        lead.textContent = t('featureOverviewLead');
        const searchRow = document.createElement('div');
        searchRow.className = 'feature-overview-search-row';
        const field = document.createElement('label');
        field.className = 'search-field feature-overview-search';
        this.search.type = 'search';
        this.search.dataset.role = 'feature-search';
        this.search.placeholder = t('featureOverviewSearchPlaceholder');
        this.search.setAttribute('aria-label', t('featureOverviewSearchLabel'));
        this.search.addEventListener('input', this.filter);
        field.append(createIcon(searchIcon), this.search);
        this.count.className = 'feature-overview-count';
        this.count.dataset.role = 'feature-count';
        this.count.setAttribute('role', 'status');
        searchRow.append(field, this.count);
        const navigation = document.createElement('nav');
        navigation.className = 'feature-overview-navigation';
        navigation.setAttribute('aria-label', t('featureOverviewTitle'));
        this.root.append(style, heading, lead, searchRow, navigation);

        for (const section of getFeatureOverviewSections()) {
            const element = document.createElement('section');
            element.className = 'feature-overview-section';
            element.dataset.featureSection = section.id;
            element.id = `feature-overview-${section.id}`;
            element.tabIndex = -1;
            const titleId = `${element.id}-title`;
            element.setAttribute('aria-labelledby', titleId);
            const jump = document.createElement('button');
            jump.type = 'button';
            jump.className = 'feature-overview-jump';
            jump.dataset.action = 'feature-jump';
            jump.dataset.section = section.id;
            jump.setAttribute('aria-controls', element.id);
            jump.textContent = section.title;
            jump.addEventListener('click', () => {
                element.scrollIntoView?.({ block: 'start', behavior: 'auto' });
                element.focus({ preventScroll: true });
            });
            navigation.append(jump);
            const sectionHeading = document.createElement('header');
            sectionHeading.className = 'feature-overview-section-heading';
            const title = document.createElement('div');
            title.className = 'feature-overview-section-title';
            const name = document.createElement('h3');
            name.id = titleId;
            name.textContent = section.title;
            const summary = document.createElement('p');
            summary.className = 'feature-overview-section-summary';
            summary.textContent = section.summary;
            title.append(name, summary);
            sectionHeading.append(createIcon(SECTION_ICONS[section.id] ?? bookOpenIcon), title);
            if (params.onOpenSettings && section.settingsCategory) {
                const settings = document.createElement('button');
                settings.type = 'button';
                settings.className = 'feature-overview-settings';
                settings.dataset.action = 'feature-open-settings';
                settings.dataset.category = section.settingsCategory;
                settings.setAttribute('aria-label', `${section.title} · ${t('featureOverviewSettings')}`);
                settings.append(document.createTextNode(t('featureOverviewSettings')), createIcon(chevronRightIcon));
                settings.addEventListener('click', () => params.onOpenSettings!(section.settingsCategory!));
                sectionHeading.append(settings);
            }
            const table = document.createElement('table');
            table.className = 'feature-overview-table';
            table.setAttribute('role', 'table');
            table.setAttribute('aria-labelledby', titleId);
            const columns = document.createElement('colgroup');
            const functionColumn = document.createElement('col');
            functionColumn.className = 'feature-overview-function-column';
            columns.append(functionColumn, document.createElement('col'));
            const header = table.createTHead().insertRow();
            for (const key of ['featureOverviewFunctionLabel', 'featureOverviewEntryColumnLabel']) {
                const cell = document.createElement('th');
                cell.scope = 'col';
                cell.textContent = t(key);
                header.append(cell);
            }
            table.prepend(columns);
            const list = table.createTBody();
            const items: SectionNodes['items'] = [];
            for (const item of section.items) {
                const row = document.createElement('tr');
                row.className = 'feature-overview-item';
                row.dataset.featureId = item.id;
                const feature = document.createElement('th');
                feature.scope = 'row';
                const name = document.createElement('h4');
                name.textContent = item.title;
                feature.append(name);
                const usage = document.createElement('td');
                const description = document.createElement('p');
                description.className = 'feature-overview-description';
                description.textContent = item.description;
                const entry = document.createElement('p');
                entry.className = 'feature-overview-entry';
                entry.textContent = `${t('featureOverviewEntryLabel')} · ${item.entry}`;
                usage.append(description, entry);
                row.append(feature, usage);
                if (item.shortcut) {
                    const shortcut = document.createElement('kbd');
                    shortcut.className = 'feature-overview-shortcut';
                    shortcut.setAttribute('aria-label', t('featureOverviewShortcutLabel'));
                    shortcut.textContent = item.shortcut;
                    usage.append(shortcut);
                }
                if (item.note) {
                    const note = document.createElement('p');
                    note.className = 'feature-overview-note';
                    note.textContent = item.note;
                    usage.append(note);
                }
                list.append(row);
                items.push({ element: row, searchText: [section.title, section.summary, item.title, item.description, item.entry, item.note, item.shortcut].filter(Boolean).join(' ').toLocaleLowerCase() });
            }
            element.append(sectionHeading, table);
            this.root.append(element);
            this.sections.push({ element, jump, items });
        }
        this.empty.className = 'feature-overview-empty';
        this.empty.dataset.role = 'feature-empty';
        const emptyText = document.createElement('p');
        emptyText.textContent = t('featureOverviewNoMatches');
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'secondary-btn';
        reset.textContent = t('featureOverviewAll');
        reset.addEventListener('click', () => { this.search.value = ''; this.filter(); this.search.focus(); });
        this.empty.append(emptyText, reset);
        this.root.append(this.empty);
        this.filter();
    }

    getElement(): HTMLElement { return this.root; }

    dispose(): void { this.search.removeEventListener('input', this.filter); }

    private filter = (): void => {
        const query = this.search.value.trim().toLocaleLowerCase();
        let count = 0;
        for (const section of this.sections) {
            let matches = 0;
            for (const item of section.items) {
                item.element.hidden = Boolean(query) && !item.searchText.includes(query);
                if (!item.element.hidden) matches += 1;
            }
            section.element.hidden = matches === 0;
            section.jump.hidden = matches === 0;
            count += matches;
        }
        this.count.textContent = t('featureOverviewCount', String(count));
        this.empty.hidden = count > 0;
    };
}
