const runtime = {
    id: 'aimd-ui-visual-mock',
    getURL: (path: string) => `/${path}`,
    getManifest: () => ({ manifest_version: 3 }),
    sendMessage: async () => undefined,
};

const mockBrowserApi = {
    runtime,
    i18n: { getMessage: (key: string) => key },
};

const globals = globalThis as typeof globalThis & {
    browser?: typeof mockBrowserApi;
    chrome?: Record<string, unknown>;
};

globals.browser ??= mockBrowserApi;
globals.chrome = Object.assign(globals.chrome ?? {}, mockBrowserApi);

export {};
