export function discoverMessageElements(container: ParentNode, selector: string): HTMLElement[] {
    const candidates: HTMLElement[] = [];

    if (container instanceof HTMLElement) {
        try {
            if (container.matches(selector)) {
                candidates.push(container);
            }
        } catch {
            // ignore invalid selector in matches(); querySelectorAll will still throw if invalid.
        }
    }

    const nodes = Array.from(container.querySelectorAll(selector)).filter(
        (n): n is HTMLElement => n instanceof HTMLElement
    );

    candidates.push(...nodes);

    // Deduplicate exact refs.
    const uniq = Array.from(new Set(candidates));

    // Remove nested matches: if any ancestor (excluding itself) also matches selector, keep only the outer one.
    return uniq.filter((el) => {
        const parent = el.parentElement;
        if (!parent) return true;
        try {
            return parent.closest(selector) === null;
        } catch {
            return true;
        }
    });
}

