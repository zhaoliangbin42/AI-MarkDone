export type SettingsFile = {
    format: 'ai-markdone-settings';
    formatVersion: 1;
    appVersion: string;
    exportedAt: string;
    settings: Record<string, unknown>;
};
export type SettingsPreferenceChange = {
    path: string;
    before: unknown;
    after: unknown;
};
export type SettingsImportPreview = {
    file: SettingsFile;
    changes: SettingsPreferenceChange[];
    ignoredCount: number;
    fingerprint: string;
};

export type SettingsRuntimeCapabilities={appVersion:string;settingsVersion:number;settingsFileFormatVersion:number;buttonsPreferences:boolean};
