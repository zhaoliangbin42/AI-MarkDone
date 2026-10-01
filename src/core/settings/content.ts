export type ContentCleanupSettings = {
    preserveLinks: boolean;
    includeCodeBlocks: boolean;
};

export const DEFAULT_CONTENT_CLEANUP_SETTINGS: ContentCleanupSettings = {
    preserveLinks: false,
    includeCodeBlocks: true,
};

export function normalizeContentCleanupSettings(value: unknown): ContentCleanupSettings {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        preserveLinks: typeof record.preserveLinks === 'boolean'
            ? record.preserveLinks : DEFAULT_CONTENT_CLEANUP_SETTINGS.preserveLinks,
        includeCodeBlocks: typeof record.includeCodeBlocks === 'boolean'
            ? record.includeCodeBlocks : DEFAULT_CONTENT_CLEANUP_SETTINGS.includeCodeBlocks,
    };
}
