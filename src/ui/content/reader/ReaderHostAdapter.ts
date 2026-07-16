import { browser } from '../../../drivers/shared/browser';

export interface ReaderHostAdapter {
    readonly document: Document;
    readonly window: Window;
    resolveAssetUrl(path: string): string;
    openExternal(url: string): void;
}

export class BrowserReaderHostAdapter implements ReaderHostAdapter {
    readonly document: Document;
    readonly window: Window;

    constructor(documentRef: Document = document, windowRef: Window = window) {
        this.document = documentRef;
        this.window = windowRef;
    }

    resolveAssetUrl(path: string): string {
        return browser.runtime.getURL(path);
    }

    openExternal(url: string): void {
        this.window.open(url, '_blank', 'noopener,noreferrer');
    }
}
