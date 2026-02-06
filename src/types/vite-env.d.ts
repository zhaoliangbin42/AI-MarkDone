interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module '*.css?raw' {
    const content: string;
    export default content;
}
