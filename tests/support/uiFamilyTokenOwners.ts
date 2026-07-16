export type UiFamilyTokenOwner = {
    definitionFile: string;
    allowedConsumers: readonly string[];
};

/** Cross-module family tokens. Single-surface implementation properties use the `--_*` namespace instead. */
export const UI_FAMILY_TOKEN_OWNERS: Readonly<Record<string, UiFamilyTokenOwner>> = {
    '--aimd-reader-markdown-body-size': {
        definitionFile: 'src/ui/content/reader/readerPanelTemplate.ts',
        allowedConsumers: [
            'src/ui/content/reader/',
            'src/services/renderer/markdownTheme.ts',
        ],
    },
    '--aimd-toolbar-hover': {
        definitionFile: 'src/ui/content/MessageToolbar.ts',
        allowedConsumers: [
            'src/ui/content/MessageToolbar.ts',
            'src/ui/content/components/TaskProgressPanel.ts',
        ],
    },
    '--aimd-toolbar-menu-surface': {
        definitionFile: 'src/ui/content/MessageToolbar.ts',
        allowedConsumers: ['src/ui/content/MessageToolbar.ts'],
    },
    '--aimd-toolbar-outline': {
        definitionFile: 'src/ui/content/MessageToolbar.ts',
        allowedConsumers: ['src/ui/content/MessageToolbar.ts'],
    },
    '--aimd-toolbar-pressed': {
        definitionFile: 'src/ui/content/MessageToolbar.ts',
        allowedConsumers: ['src/ui/content/MessageToolbar.ts'],
    },
    '--aimd-toolbar-surface': {
        definitionFile: 'src/ui/content/MessageToolbar.ts',
        allowedConsumers: ['src/ui/content/MessageToolbar.ts'],
    },
};
