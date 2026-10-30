import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_STORAGE_KEYS } from '@/contracts/storage';

vi.mock('@/runtimes/background/handlers/bookmarks', () => ({
    handleBookmarksRequest: vi.fn(async () => null),
    recoverJournalIfAny: vi.fn(async () => undefined),
    recordPendingChangelogNotice: vi.fn(async () => undefined),
}));

const key = LEGACY_STORAGE_KEYS.appSettingsKey;

async function setup(initial: Record<string, unknown> = {}) {
    const state = structuredClone(initial);
    let installed: (details: { reason: string }) => void = () => { throw new Error('Missing install listener'); };
    const sync = {
        get: vi.fn(async () => structuredClone(state)),
        set: vi.fn(async (patch: Record<string, unknown>) => { Object.assign(state, structuredClone(patch)); }),
    };
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('browser', {
        runtime: {
            getManifest: () => ({ manifest_version: 3, version: '6.1.0' }),
            onInstalled: { addListener: (listener: typeof installed) => { installed = listener; } },
            onMessage: { addListener: vi.fn() },
        },
        storage: { sync },
    });
    await import('@/runtimes/background/entry');
    const { handleSettingsRequest } = await import('@/runtimes/background/handlers/settings');
    return {
        state, sync,
        install: (reason = 'install') => installed({ reason }),
        read: async () => {
            const response = (await handleSettingsRequest({ v: 1, id: 'read', type: 'settings:getAll' }))!.response;
            expect(response.ok).toBe(true);
            return (response as { data: { settings: { chatgptDirectory: { enabled: boolean } } } }).data.settings;
        },
        setEnabled: (enabled: boolean) => handleSettingsRequest({ v: 1, id: 'write', type: 'settings:setCategory', payload: { category: 'chatgptDirectory', value: { enabled } } }),
    };
}

describe('first-install Directory default through the real background event', () => {
    beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('persists the directory defaults after the browser reports a fresh installation', async () => {
        const fixture = await setup();
        fixture.install();
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(true);
        expect(fixture.sync.set).toHaveBeenCalledOnce();
        expect(Object.keys(fixture.sync.set.mock.calls[0]![0])).toEqual([key]);
    });

    it.each(['update', 'chrome_update', 'shared_module_update'])('uses default-on without writing an unconfigured install for %s', async reason => {
        const fixture = await setup();
        fixture.install(reason);
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(true);
        expect(fixture.sync.set).not.toHaveBeenCalled();
    });

    it('does not initialize an existing profile on ordinary reads', async () => {
        const fixture = await setup();
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(true);
        expect(fixture.sync.set).not.toHaveBeenCalled();
    });

    it.each([
        null, undefined,
        { version: 1 }, { version: 2 }, { version: 3 }, { version: 4 },
        { version: 5 }, { version: 5, chatgptDirectory: {} },
        { version: 5, chatgptDirectory: { enabled: false } },
        { version: 5, chatgptDirectory: { enabled: true } },
    ])('does not overwrite any existing settings record: %j', async stored => {
        const fixture = await setup({ [key]: stored });
        fixture.install();
        const settings = await fixture.read();
        const previous = stored as { chatgptDirectory?: { enabled?: boolean } } | null | undefined;
        expect(settings.chatgptDirectory.enabled).toBe(previous?.chatgptDirectory?.enabled ?? true);
        expect(fixture.state).toEqual({ [key]: stored });
        expect(fixture.sync.set).not.toHaveBeenCalled();
    });

    it('is idempotent and never re-enables a directory the user later disabled', async () => {
        const fixture = await setup();
        fixture.install(); fixture.install();
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(true);
        expect(fixture.sync.set).toHaveBeenCalledOnce();
        await fixture.setEnabled(false);
        fixture.install();
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(false);
        expect(fixture.sync.set).toHaveBeenCalledTimes(2);
    });

    it('waits for install persistence before responding to a settings read', async () => {
        const fixture = await setup();
        let release!: () => void;
        fixture.sync.set.mockImplementationOnce(async patch => {
            await new Promise<void>(resolve => { release = resolve; });
            Object.assign(fixture.state, structuredClone(patch));
        });
        fixture.install();
        let returned = false;
        const read = fixture.read().then(settings => { returned = true; return settings; });
        await vi.waitFor(() => expect(fixture.sync.set).toHaveBeenCalledOnce());
        expect(returned).toBe(false);
        release();
        expect((await read).chatgptDirectory.enabled).toBe(true);
    });

    it('does not deadlock or override a user write already ahead of install initialization', async () => {
        const fixture = await setup();
        let release!: () => void;
        fixture.sync.get.mockImplementationOnce(async () => {
            await new Promise<void>(resolve => { release = resolve; });
            return {};
        });
        const write = fixture.setEnabled(false);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        fixture.install(); release();
        await write;
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(false);
        expect(fixture.sync.set).toHaveBeenCalledOnce();
    });

    it('re-reads if installation begins while an earlier settings read is in flight', async () => {
        const fixture = await setup();
        let release!: () => void;
        fixture.sync.get.mockImplementationOnce(async () => {
            await new Promise<void>(resolve => { release = resolve; });
            return {};
        });
        const read = fixture.read();
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        fixture.install();
        await vi.waitFor(() => expect(fixture.sync.set).toHaveBeenCalledOnce());
        release();
        expect((await read).chatgptDirectory.enabled).toBe(true);
    });

    it('keeps subsequent settings operations usable if install persistence fails', async () => {
        const fixture = await setup();
        fixture.sync.set.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));
        fixture.install();
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(true);
        await fixture.setEnabled(true);
        expect((await fixture.read()).chatgptDirectory.enabled).toBe(true);
    });
});
