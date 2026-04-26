export type ActionApi = {
    setIcon?: (...args: any[]) => unknown;
    setPopup?: (...args: any[]) => unknown;
    onClicked?: { addListener?: (...args: any[]) => unknown };
};

export function resolveActionApi(browserLike: any): ActionApi | null {
    return browserLike?.action || browserLike?.browserAction || null;
}
