import { beforeEach, describe, expect, it, vi } from 'vitest';

const addRuntimeMessageListener = vi.fn();
let installedListener: ((details: { reason?: string; previousVersion?: string }) => void) | null = null;
let runtimeMessageListener: ((msg: unknown, sender: any, sendResponse: (response: unknown) => void) => boolean | undefined) | null = null;
let tabUpdatedListener: ((tabId: number, changeInfo: { status?: string; url?: string }, tab: { url?: string }) => void) | null = null;
let tabActivatedListener: ((activeInfo: { tabId: number }) => void | Promise<void>) | null = null;
let actionClickedListener: ((tab: { id?: number; url?: string }) => void | Promise<void>) | null = null;
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
        runtimeMessageListener = null;
        tabUpdatedListener = null;
        tabActivatedListener = null;
        actionClickedListener = null;
        const runtimeApi = {
            runtime: {
                getManifest: () => ({
                    manifest_version: 3,
                    version: '4.1.2',
                    host_permissions: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
                }),
                onInstalled: {
                    addListener: (listener: (details: { reason?: string; previousVersion?: string }) => void) => {
                        installedListener = listener;
                    },
                },
                onMessage: {
                    addListener: (listener: (msg: unknown, sender: any, sendResponse: (response: unknown) => void) => boolean | undefined) => {
                        runtimeMessageListener = listener;
                        addRuntimeMessageListener(listener);
                    },
                },
            },
            tabs: {
                get: vi.fn(async (tabId: number) => ({ id: tabId, url: 'https://chatgpt.com/c/mock' })),
                sendMessage: vi.fn(async () => ({ ok: true })),
                onUpdated: {
                    addListener: vi.fn((listener: typeof tabUpdatedListener) => {
                        tabUpdatedListener = listener;
                    }),
                },
                onActivated: {
                    addListener: vi.fn((listener: typeof tabActivatedListener) => {
                        tabActivatedListener = listener;
                    }),
                },
            },
            action: {
                onClicked: {
                    addListener: vi.fn((listener: typeof actionClickedListener) => {
                        actionClickedListener = listener;
                    }),
                },
                setIcon: vi.fn(async () => undefined),
                setPopup: vi.fn(async () => undefined),
            },
        };
        (globalThis as any).chrome = runtimeApi;
        (globalThis as any).browser = runtimeApi;
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

    it('ignores missing tabs when activation races with Chrome lifecycle cleanup', async () => {
        await import('@/runtimes/background/entry');
        const tabs = (globalThis as any).browser.tabs;
        tabs.get.mockRejectedValueOnce(new Error('No tab with id: 44086653.'));

        await tabActivatedListener?.({ tabId: 44086653 });
        await Promise.resolve();

        expect(tabs.get).toHaveBeenCalledWith(44086653);
        expect((globalThis as any).browser.action.setIcon).not.toHaveBeenCalled();
    });

    it('ignores stale tab failures while updating action state', async () => {
        await import('@/runtimes/background/entry');
        const action = (globalThis as any).browser.action;
        action.setIcon.mockRejectedValueOnce(new Error('No tab with id: 44086653.'));

        tabUpdatedListener?.(44086653, { status: 'complete' }, { url: 'https://chatgpt.com/c/mock' });
        await Promise.resolve();
        await Promise.resolve();

        expect(action.setIcon).toHaveBeenCalledWith(expect.objectContaining({ tabId: 44086653 }));
        expect(action.setPopup).not.toHaveBeenCalled();
    });

    it('pings the clicked ChatGPT tab before toggling the toolbar', async () => {
        await import('@/runtimes/background/entry');
        const tabs = (globalThis as any).browser.tabs;

        await actionClickedListener?.({ id: 42, url: 'https://chatgpt.com/c/mock' });
        await Promise.resolve();

        expect(tabs.sendMessage).toHaveBeenNthCalledWith(1, 42, expect.objectContaining({ type: 'ping' }));
        expect(tabs.sendMessage).toHaveBeenNthCalledWith(2, 42, expect.objectContaining({ type: 'ui:toggle_toolbar' }));
    });

    it('does not toggle the toolbar when the clicked tab has no content receiver', async () => {
        await import('@/runtimes/background/entry');
        const tabs = (globalThis as any).browser.tabs;
        tabs.sendMessage.mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'));

        await actionClickedListener?.({ id: 42, url: 'https://chatgpt.com/c/mock' });
        await Promise.resolve();

        expect(tabs.sendMessage).toHaveBeenCalledTimes(1);
        expect(tabs.sendMessage).toHaveBeenCalledWith(42, expect.objectContaining({ type: 'ping' }));
    });

    it('updates action state from content ready when sender tab is available', async () => {
        await import('@/runtimes/background/entry');
        const sendResponse = vi.fn();

        runtimeMessageListener?.(
            { v: 1, id: 'ready_1', type: 'content:ready', payload: { platform: 'chatgpt', url: 'https://chatgpt.com/c/mock' } },
            { tab: { id: 42, url: 'https://chatgpt.com/c/mock' } },
            sendResponse,
        );
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect((globalThis as any).browser.action.setIcon).toHaveBeenCalledWith(expect.objectContaining({ tabId: 42 }));
        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, data: { ready: true } }));
    });

    it('ignores content ready without a sender tab id', async () => {
        await import('@/runtimes/background/entry');
        const sendResponse = vi.fn();

        runtimeMessageListener?.(
            { v: 1, id: 'ready_2', type: 'content:ready', payload: { platform: 'chatgpt', url: 'https://chatgpt.com/c/mock' } },
            {},
            sendResponse,
        );
        await Promise.resolve();

        expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, data: { ready: false } }));
    });
});
