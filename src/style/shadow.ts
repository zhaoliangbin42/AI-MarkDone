type ShadowStyleCacheMode = 'root' | 'shared';

type ShadowStyleOptions = {
    id?: string;
    cache?: ShadowStyleCacheMode;
};

type RootStyleRecord =
    | { kind: 'tag'; styleEl: HTMLStyleElement }
    | { kind: 'sheet'; key: string; sheet: CSSStyleSheet };

const rootStyleRegistry = new WeakMap<ShadowRoot, Map<string, RootStyleRecord>>();
const sharedSheetRegistry = new Map<string, CSSStyleSheet>();

function getRootRegistry(shadowRoot: ShadowRoot): Map<string, RootStyleRecord> {
    let registry = rootStyleRegistry.get(shadowRoot);
    if (!registry) {
        registry = new Map<string, RootStyleRecord>();
        rootStyleRegistry.set(shadowRoot, registry);
    }
    return registry;
}

function supportsConstructedStylesheets(shadowRoot: ShadowRoot): boolean {
    return typeof (globalThis as any).CSSStyleSheet !== 'undefined'
        && typeof (globalThis as any).CSSStyleSheet?.prototype?.replaceSync === 'function'
        && 'adoptedStyleSheets' in shadowRoot;
}

function removeExistingRecord(shadowRoot: ShadowRoot, record: RootStyleRecord): void {
    if (record.kind === 'tag') {
        record.styleEl.remove();
        return;
    }

    const currentSheets = ((shadowRoot as any).adoptedStyleSheets || []) as CSSStyleSheet[];
    (shadowRoot as any).adoptedStyleSheets = currentSheets.filter((sheet) => sheet !== record.sheet);
}

function ensureRootStyle(shadowRoot: ShadowRoot, cssText: string, id: string): HTMLStyleElement {
    const registry = getRootRegistry(shadowRoot);
    const existing = registry.get(id);

    if (existing?.kind === 'tag') {
        existing.styleEl.textContent = cssText;
        return existing.styleEl;
    }

    if (existing) {
        removeExistingRecord(shadowRoot, existing);
    }

    const style = document.createElement('style');
    style.setAttribute('data-aimd-style-id', id);
    style.textContent = cssText;
    shadowRoot.appendChild(style);
    registry.set(id, { kind: 'tag', styleEl: style });
    return style;
}

function ensureSharedStyle(shadowRoot: ShadowRoot, cssText: string, id: string): CSSStyleSheet | HTMLStyleElement {
    if (!supportsConstructedStylesheets(shadowRoot)) {
        return ensureRootStyle(shadowRoot, cssText, id);
    }

    const registry = getRootRegistry(shadowRoot);
    const key = `${id}::${cssText}`;
    const existing = registry.get(id);
    if (existing?.kind === 'sheet' && existing.key === key) {
        return existing.sheet;
    }

    if (existing) {
        removeExistingRecord(shadowRoot, existing);
    }

    let sheet = sharedSheetRegistry.get(key);
    if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        sharedSheetRegistry.set(key, sheet);
    }

    const currentSheets = ((shadowRoot as any).adoptedStyleSheets || []) as CSSStyleSheet[];
    if (!currentSheets.includes(sheet)) {
        (shadowRoot as any).adoptedStyleSheets = [...currentSheets, sheet];
    }
    registry.set(id, { kind: 'sheet', key, sheet });
    return sheet;
}

export function ensureStyle(shadowRoot: ShadowRoot, cssText: string, opts?: ShadowStyleOptions): HTMLStyleElement | CSSStyleSheet {
    if (!opts?.id) {
        const style = document.createElement('style');
        style.textContent = cssText;
        shadowRoot.appendChild(style);
        return style;
    }

    if (opts.cache === 'shared') {
        return ensureSharedStyle(shadowRoot, cssText, opts.id);
    }

    return ensureRootStyle(shadowRoot, cssText, opts.id);
}
