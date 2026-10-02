import { t } from '../../components/i18n';

export type FeatureOverviewSettingsCategory = 'reading' | 'input' | 'controls' | 'data' | 'export' | 'marks' | 'appearance' | 'advanced';

export type FeatureOverviewItem = {
    id: string;
    title: string;
    description: string;
    entry: string;
    shortcut?: string;
    note?: string;
};

export type FeatureOverviewSection = {
    id: string;
    title: string;
    summary: string;
    settingsCategory?: FeatureOverviewSettingsCategory;
    items: readonly FeatureOverviewItem[];
};

type SectionDefinition = {
    id: string;
    settingsCategory: FeatureOverviewSettingsCategory;
    items: readonly { id: string; shortcut?: string; hasNote?: boolean }[];
};

const SECTIONS: readonly SectionDefinition[] = [
    {
        id: 'reader', settingsCategory: 'reading',
        items: [
            { id: 'reader-focus' },
            { id: 'reader-outline', hasNote: true },
            { id: 'reader-pages', shortcut: '← / → · ↑ / ↓' },
            { id: 'reader-position', hasNote: true },
            { id: 'reader-code' },
            { id: 'reader-excerpts', hasNote: true },
            { id: 'reader-send' },
            { id: 'reader-locate' },
            { id: 'reader-separate', hasNote: true },
        ],
    },
    {
        id: 'navigation', settingsCategory: 'reading',
        items: [
            { id: 'navigation-directory', hasNote: true },
            { id: 'navigation-preview' },
            { id: 'navigation-stepper', shortcut: '← / →' },
            { id: 'navigation-send-position' },
        ],
    },
    {
        id: 'copyExport', settingsCategory: 'export',
        items: [
            { id: 'copy-markdown' },
            { id: 'copy-question-reply' },
            { id: 'copy-image' },
            { id: 'copy-selection', shortcut: 'Cmd/Ctrl + Shift + C', hasNote: true },
            { id: 'export-formats', hasNote: true },
            { id: 'export-image-settings' },
        ],
    },
    {
        id: 'input', settingsCategory: 'input',
        items: [
            { id: 'input-newline', shortcut: 'Enter · Cmd/Ctrl + Enter' },
            { id: 'input-bold', shortcut: 'Cmd/Ctrl + B' },
            { id: 'input-lists' },
            { id: 'input-prompt-library' },
            { id: 'input-prompt-trigger', shortcut: '↑ / ↓ · Enter / Tab · Esc' },
            { id: 'input-prompt-cursor', hasNote: true },
            { id: 'input-prompt-notes', shortcut: '→' },
        ],
    },
    {
        id: 'formula', settingsCategory: 'export',
        items: [
            { id: 'formula-source' },
            { id: 'formula-formats' },
            { id: 'formula-suggestions', shortcut: '↑ / ↓ · Enter / Tab' },
            { id: 'formula-preview' },
            { id: 'formula-assets', hasNote: true },
        ],
    },
    {
        id: 'library', settingsCategory: 'data',
        items: [
            { id: 'library-save-reply' },
            { id: 'library-save-page', hasNote: true },
            { id: 'library-search' },
            { id: 'library-folders' },
            { id: 'library-batch' },
            { id: 'library-summaries', hasNote: true },
        ],
    },
    {
        id: 'marks', settingsCategory: 'marks',
        items: [
            { id: 'marks-add-note', shortcut: 'Cmd/Ctrl + Enter' },
            { id: 'marks-save-annotations', hasNote: true },
            { id: 'marks-highlight', hasNote: true },
            { id: 'marks-notes-manage' },
            { id: 'marks-notes-output' },
            { id: 'marks-notes-template' },
            { id: 'marks-organize' },
        ],
    },
    {
        id: 'settingsBackup', settingsCategory: 'data',
        items: [
            { id: 'settings-appearance' },
            { id: 'settings-buttons' },
            { id: 'settings-content-rules', hasNote: true },
            { id: 'backup-local', hasNote: true },
            { id: 'backup-drive', hasNote: true },
            { id: 'backup-settings-transfer', hasNote: true },
        ],
    },
];

function keyPart(id: string): string {
    return id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');
}

/** Stable IDs connect searchable user guidance to its group without storing UI copy. */
export function getFeatureOverviewSections(): readonly FeatureOverviewSection[] {
    return SECTIONS.map(section => {
        const sectionKey = `featureOverviewSection${keyPart(section.id)}`;
        return {
            id: section.id,
            title: t(sectionKey + 'Title'),
            summary: t(sectionKey + 'Summary'),
            settingsCategory: section.settingsCategory,
            items: section.items.map(item => {
                const itemKey = `featureOverview${keyPart(item.id)}`;
                return {
                    id: item.id,
                    title: t(itemKey + 'Title'),
                    description: t(itemKey + 'Description'),
                    entry: t(itemKey + 'Entry'),
                    ...(item.shortcut ? { shortcut: item.shortcut } : {}),
                    ...(item.hasNote ? { note: t(itemKey + 'Note') } : {}),
                };
            }),
        };
    });
}
