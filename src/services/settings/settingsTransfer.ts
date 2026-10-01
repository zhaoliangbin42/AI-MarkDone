import type { AppSettings } from '../../core/settings/types';
import { listSettingsChanges, parseSettingsFile } from '../../core/settings/portableSettings';
import type { SettingsImportPreview } from '../../contracts/settingsTransfer';
export async function fingerprintSettings(settings: AppSettings): Promise<string> {
    // Include non-portable preferences too: an import must not overwrite edits
    // made while its preview was open. Only the opaque digest leaves background.
    const bytes = new TextEncoder().encode(JSON.stringify(settings));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function previewSettingsImport(settings: AppSettings, text: string, currentAppVersion?: string): Promise<SettingsImportPreview> {
    const { file, ignoredCount } = parseSettingsFile(text,currentAppVersion);
    return { file, ignoredCount, changes: listSettingsChanges(settings, file.settings), fingerprint: await fingerprintSettings(settings) };
}
