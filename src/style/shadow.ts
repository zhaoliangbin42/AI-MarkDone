export function ensureStyle(shadowRoot: ShadowRoot, cssText: string): void {
    const style = document.createElement('style');
    style.textContent = cssText;
    shadowRoot.appendChild(style);
}

