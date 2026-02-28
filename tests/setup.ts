import { vi } from 'vitest';

// Some legacy modules (under `archive/`) import `webextension-polyfill` which throws
// when not running inside a real extension runtime. For parity tests we stub it.
vi.mock('webextension-polyfill', () => {
    const browserLike = {
        runtime: {
            getURL: (path: string) => path,
            getManifest: () => ({ version: '0.0.0-test' }),
            onMessage: { addListener: () => {}, removeListener: () => {} },
            sendMessage: async () => undefined,
        },
        i18n: { getMessage: () => '' },
        storage: {
            local: { get: async () => ({}), set: async () => undefined },
            sync: { get: async () => ({}), set: async () => undefined },
        },
        action: { setIcon: async () => undefined, setPopup: async () => undefined },
        browserAction: { setIcon: async () => undefined, setPopup: async () => undefined },
        tabs: { query: async () => [], sendMessage: async () => undefined },
    };

    return { default: browserLike };
});

