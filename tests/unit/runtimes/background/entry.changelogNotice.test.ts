import { beforeEach, describe, expect, it, vi } from 'vitest';

const addRuntimeMessageListener = vi.fn();
let installedListener: ((details: { reason?: string; previousVersion?: string }) => void) | null = null;
const recordPendingChangelogNotice = vi.fn(async () => ({
    pendingVersion: '4.1.2',
    lastShownVersion: null,
    reason: 'update',
    previousVersion: '4.1.0',
}));

vi.mock('@/runtimes/background/handlers/bookmarks', () => ({
    handleBookmarksRequest: vi.fn(async () => null),
    recoverJournalIfAny: vi.fn(async () => undefined),
    recordPendingChangelogNotice,
}));

vi.mock('@/runtimes/background/handlers/settings', () => ({
    handleSettingsRequest: vi.fn(async () => null),
}));

describe('background entry changelog notice wiring', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        installedListener = null;
        (globalThis as any).chrome = {
            runtime: {
                getManifest: () => ({ manifest_version: 3, version: '4.1.2' }),
                onInstalled: {
                    addListener: (listener: (details: { reason?: string; previousVersion?: string }) => void) => {
                        installedListener = listener;
                    },
                },
                onMessage: {
                    addListener: addRuntimeMessageListener,
                },
            },
            tabs: {
                onUpdated: { addListener: vi.fn() },
                onActivated: { addListener: vi.fn() },
            },
            action: {
                onClicked: { addListener: vi.fn() },
                setIcon: vi.fn(async () => undefined),
                setPopup: vi.fn(async () => undefined),
            },
        };
        delete (globalThis as any).browser;
    });

    it('records a pending notice on extension update', async () => {
        await import('@/runtimes/background/entry');

        expect(installedListener).toBeTypeOf('function');
        installedListener?.({ reason: 'update', previousVersion: '4.1.0' });
        await Promise.resolve();

        expect(recordPendingChangelogNotice).toHaveBeenCalledWith({
            currentVersion: '4.1.2',
            reason: 'update',
            previousVersion: '4.1.0',
        });
    });

    it('ignores browser update events for changelog notice recording', async () => {
        await import('@/runtimes/background/entry');

        installedListener?.({ reason: 'chrome_update', previousVersion: '4.1.0' });
        await Promise.resolve();

        expect(recordPendingChangelogNotice).not.toHaveBeenCalled();
    });
});
