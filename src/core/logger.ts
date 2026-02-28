type LogArgs = [message: string, ...args: unknown[]];

function isDebugEnabled(): boolean {
    try {
        // Allow enabling debug logs on pages during manual testing.
        // - Content pages: localStorage flag
        // - Background: global flag (service worker has no localStorage)
        if (typeof (globalThis as any).__AIMD_DEBUG__ === 'boolean') {
            return Boolean((globalThis as any).__AIMD_DEBUG__);
        }
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('aimd_debug') === '1';
        }
    } catch {
        // ignore
    }
    return false;
}

export const logger = {
    debug: (...args: LogArgs) => {
        if (!isDebugEnabled()) return;
        console.debug(...args);
    },
    info: (...args: LogArgs) => console.info(...args),
    warn: (...args: LogArgs) => console.warn(...args),
    error: (...args: LogArgs) => console.error(...args),
};

