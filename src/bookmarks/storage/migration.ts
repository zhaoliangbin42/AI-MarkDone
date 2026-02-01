/**
 * Bookmark migration logic
 * 
 * Handles migration of existing bookmarks to folder system:
 * - Creates "Import" folder if needed
 * - Migrates bookmarks without folderPath to "Import"
 * - Runs only once on first load after update
 */

import { FolderStorage } from './FolderStorage';
import { SimpleBookmarkStorage } from './SimpleBookmarkStorage';
import { browser } from '../../utils/browser';
import { logger } from '../../utils/logger';

const migrationLogger = {
    info: (message: string, ...args: any[]) => logger.info('[AI-MarkDone][Migration]', message, ...args),
    error: (message: string, ...args: any[]) => logger.error('[AI-MarkDone][Migration]', message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn('[AI-MarkDone][Migration]', message, ...args),
};

/**
 * Bookmark migration manager
 */
export class BookmarkMigration {
    /** Storage key for migration flag */
    private static readonly MIGRATION_FLAG_KEY = 'bookmarksMigrated';

    /** Default folder for migrated bookmarks */
    private static readonly IMPORT_FOLDER_PATH = 'Import';

    /**
     * Run migration if needed
     * 
     * This is the main entry point for migration.
     * Call this on extension startup or panel initialization.
     */
    static async runIfNeeded(): Promise<void> {
        try {
            const migrated = await this.isMigrated();
            if (migrated) {
                migrationLogger.info('Already migrated, skipping');
                return;
            }

            migrationLogger.info('Starting bookmark migration...');
            const result = await this.migrate();
            await this.setMigrated();

            migrationLogger.info(`Migration complete: ${result.migratedCount} bookmarks migrated`);
        } catch (error) {
            migrationLogger.error('Migration failed:', error);
            throw error;
        }
    }

    /**
     * Perform migration
     * 
     * Steps:
     * 1. Create "Import" folder if not exists
     * 2. Get all bookmarks
     * 3. Update bookmarks without folderPath
     * 
     * @returns Migration statistics
     */
    private static async migrate(): Promise<{ migratedCount: number }> {
        try {
            // 1. Create "Import" folder if not exists
            const importFolder = await FolderStorage.get(this.IMPORT_FOLDER_PATH);
            if (!importFolder) {
                await FolderStorage.create(this.IMPORT_FOLDER_PATH);
                migrationLogger.info('Created "Import" folder');
            }

            // 2. Get all bookmarks
            const bookmarks = await SimpleBookmarkStorage.getAllBookmarks();
            migrationLogger.info(`Found ${bookmarks.length} bookmarks to check`);

            // 3. Update bookmarks without folderPath
            let migratedCount = 0;
            const updates: Record<string, any> = {};

            for (const bookmark of bookmarks) {
                // Check if bookmark needs migration
                if (!bookmark.folderPath || bookmark.folderPath === '') {
                    const key = `bookmark:${bookmark.urlWithoutProtocol}:${bookmark.position}`;
                    updates[key] = {
                        ...bookmark,
                        folderPath: this.IMPORT_FOLDER_PATH,
                        // Ensure required fields are present
                        title: bookmark.title || bookmark.userMessage.substring(0, 50) + (bookmark.userMessage.length > 50 ? '...' : ''),
                        platform: bookmark.platform || 'ChatGPT'
                    };
                    migratedCount++;
                }
            }

            // Batch update all bookmarks
            if (Object.keys(updates).length > 0) {
                await browser.storage.local.set(updates);
                migrationLogger.info(`Migrated ${migratedCount} bookmarks to "Import" folder`);
            } else {
                migrationLogger.info('No bookmarks needed migration');
            }

            return { migratedCount };

        } catch (error) {
            migrationLogger.error('Migration process failed:', error);
            throw error;
        }
    }

    /**
     * Check if migration has been completed
     */
    private static async isMigrated(): Promise<boolean> {
        try {
            const result = await browser.storage.local.get(this.MIGRATION_FLAG_KEY);
            return !!result[this.MIGRATION_FLAG_KEY];
        } catch (error) {
            migrationLogger.error('Failed to check migration status:', error);
            return false;
        }
    }

    /**
     * Mark migration as completed
     */
    private static async setMigrated(): Promise<void> {
        try {
            await browser.storage.local.set({
                [this.MIGRATION_FLAG_KEY]: true,
                migrationDate: Date.now()
            });
            migrationLogger.info('Migration flag set');
        } catch (error) {
            migrationLogger.error('Failed to set migration flag:', error);
            throw error;
        }
    }

    /**
     * Reset migration flag (for testing/debugging)
     * 
     * WARNING: This will cause migration to run again on next load
     */
    static async resetMigration(): Promise<void> {
        try {
            await browser.storage.local.remove([this.MIGRATION_FLAG_KEY, 'migrationDate']);
            migrationLogger.warn('Migration flag reset - migration will run on next load');
        } catch (error) {
            migrationLogger.error('Failed to reset migration flag:', error);
            throw error;
        }
    }

    /**
     * Get migration status and statistics
     */
    static async getStatus(): Promise<{
        migrated: boolean;
        migrationDate?: number;
        totalBookmarks: number;
        bookmarksInImport: number;
    }> {
        try {
            const migrated = await this.isMigrated();
            const result = await browser.storage.local.get('migrationDate');
            const migrationDate = result.migrationDate as number | undefined;

            const allBookmarks = await SimpleBookmarkStorage.getAllBookmarks();
            const bookmarksInImport = allBookmarks.filter(b => b.folderPath === this.IMPORT_FOLDER_PATH).length;

            return {
                migrated,
                migrationDate,
                totalBookmarks: allBookmarks.length,
                bookmarksInImport
            };
        } catch (error) {
            migrationLogger.error('Failed to get migration status:', error);
            return {
                migrated: false,
                totalBookmarks: 0,
                bookmarksInImport: 0
            };
        }
    }
}
