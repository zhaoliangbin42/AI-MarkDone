export type RuntimeApi = {
    getManifest?: () => { manifest_version?: number; version?: string; [key: string]: unknown };
    getURL?: (path: string) => string;
    onInstalled?: { addListener?: (...args: any[]) => unknown };
    onMessage?: { addListener?: (...args: any[]) => unknown };
    sendMessage?: (...args: any[]) => unknown;
};

export function resolveRuntimeApi(browserLike: any): RuntimeApi | null {
    return browserLike?.runtime || null;
}
