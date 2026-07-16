type ShadowStyleCacheMode = 'root' | 'shared';

type ShadowStyleOptions = {
    id?: string;
    cache?: ShadowStyleCacheMode;
    sharedKey?: string;
};

type RootStyleRecord =
    | { kind: 'tag'; styleEl: HTMLStyleElement }
    | { kind: 'sheet'; key: string; sheet: CSSStyleSheet };

const rootStyleRegistry = new WeakMap<ShadowRoot, Map<string, RootStyleRecord>>();
const sharedSheetRegistry = new Map<string, { sheet: CSSStyleSheet; references: number }>();

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

function getAdoptedStyleSheets(shadowRoot: ShadowRoot): CSSStyleSheet[] | null {
    const sheets = ((shadowRoot as any).adoptedStyleSheets || []) as unknown;
    if (!Array.isArray(sheets)) return null;
    if (typeof (sheets as CSSStyleSheet[]).some !== 'function') return null;
    if (typeof (sheets as CSSStyleSheet[]).filter !== 'function') return null;
    return sheets as CSSStyleSheet[];
}

function removeExistingRecord(shadowRoot: ShadowRoot, record: RootStyleRecord): void {
    if (record.kind === 'tag') {
        record.styleEl.remove();
        return;
    }

    const currentSheets = getAdoptedStyleSheets(shadowRoot);
    if (!currentSheets) return;
    try {
        (shadowRoot as any).adoptedStyleSheets = currentSheets.filter((sheet) => sheet !== record.sheet);
        const shared = sharedSheetRegistry.get(record.key);
        if (shared?.sheet === record.sheet) {
            shared.references -= 1;
            if (shared.references <= 0) sharedSheetRegistry.delete(record.key);
        }
    } catch {
        // If the browser rejects assignment, leave the orphaned constructed sheet alone and let callers fall back.
    }
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

function ensureSharedStyle(
    shadowRoot: ShadowRoot,
    cssText: string,
    id: string,
    sharedKey: string,
): CSSStyleSheet | HTMLStyleElement {
    if (!supportsConstructedStylesheets(shadowRoot)) {
        return ensureRootStyle(shadowRoot, cssText, id);
    }

    const currentSheets = getAdoptedStyleSheets(shadowRoot);
    if (!currentSheets) {
        return ensureRootStyle(shadowRoot, cssText, id);
    }

    const registry = getRootRegistry(shadowRoot);
    const key = `${sharedKey}::${cssText}`;
    const existing = registry.get(id);
    if (existing?.kind === 'sheet' && existing.key === key) {
        return existing.sheet;
    }

    if (existing) {
        removeExistingRecord(shadowRoot, existing);
    }

    let shared = sharedSheetRegistry.get(key);
    if (!shared) {
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(cssText);
            shared = { sheet, references: 0 };
        } catch {
            return ensureRootStyle(shadowRoot, cssText, id);
        }
        sharedSheetRegistry.set(key, shared);
    }
    const { sheet } = shared;

    if (!currentSheets.some((candidate) => candidate === sheet)) {
        try {
            (shadowRoot as any).adoptedStyleSheets = [...currentSheets, sheet];
        } catch {
            if (shared.references === 0 && sharedSheetRegistry.get(key)?.sheet === sheet) {
                sharedSheetRegistry.delete(key);
            }
            return ensureRootStyle(shadowRoot, cssText, id);
        }
    }
    registry.set(id, { kind: 'sheet', key, sheet });
    shared.references += 1;
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
        return ensureSharedStyle(shadowRoot, cssText, opts.id, opts.sharedKey ?? opts.id);
    }

    return ensureRootStyle(shadowRoot, cssText, opts.id);
}

export function removeStyle(shadowRoot: ShadowRoot, id: string): void {
    const registry = rootStyleRegistry.get(shadowRoot);
    const existing = registry?.get(id);
    if (!registry || !existing) return;
    removeExistingRecord(shadowRoot, existing);
    registry.delete(id);
    if (registry.size === 0) rootStyleRegistry.delete(shadowRoot);
}
