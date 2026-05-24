/// <reference types="vite/client" />

declare module '*.md?raw' {
    const content: string;
    export default content;
}

declare const __AIMD_ENABLE_SPONSOR_TAB__: boolean | undefined;
declare const __AIMD_ENABLE_SOCIAL_FOLLOW_CARD__: boolean | undefined;
declare const __AIMD_ENABLE_BINARY_CLIPBOARD_COPY_ACTIONS__: boolean | undefined;

declare global {
    interface Window {
        __AIMD_PERF__?: {
            configure: (flags: Record<string, boolean>) => Record<string, boolean>;
            enable: () => Record<string, boolean>;
            disable: () => Record<string, boolean>;
            flags: () => Record<string, boolean>;
            reset: () => void;
            summary: () => unknown;
            export: () => string;
        };
        __AIMD_PERF_ENABLED__?: boolean;
        __AIMD_PERF_FLAGS__?: Record<string, boolean>;
    }
}
