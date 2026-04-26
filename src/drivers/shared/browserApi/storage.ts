export type StorageApi = {
    local?: unknown;
    sync?: unknown;
    onChanged?: { addListener?: (...args: any[]) => unknown };
};

export function resolveStorageApi(browserLike: any): StorageApi {
    return browserLike?.storage || {};
}
