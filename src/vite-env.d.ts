/// <reference types="vite/client" />

declare module '*.md?raw' {
    const content: string;
    export default content;
}

declare const __AIMD_ENABLE_SPONSOR_TAB__: boolean | undefined;
declare const __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__: boolean | undefined;
declare const __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__: boolean | undefined;

interface Window {
    /**
     * Content-runtime troubleshooting seam (ChatGPT pages only). Returns the
     * read-only discovery diagnostics snapshot; never exposes message content.
     */
    __AIMD_DISCOVERY_DIAGNOSTICS__?: () => unknown;
}
