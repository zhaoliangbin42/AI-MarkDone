const SHADOW_STYLE_MARK = 'data-aimd-tooltip-style';
const DOC_STYLE_ID = 'aimd-shared-tooltip-style';

type TooltipVariant = 'label' | 'preview' | 'ephemeral';

type TooltipTarget = HTMLElement & {
    dataset: DOMStringMap & {
        tooltip?: string;
        tooltipTitle?: string;
        tooltipVariant?: TooltipVariant;
    };
};

function getTooltipCss(): string {
    return `
.aimd-tooltip {
  position: fixed;
  left: 0;
  top: 0;
  max-width: 260px;
  padding: var(--aimd-space-2) var(--aimd-space-3);
  border-radius: var(--aimd-radius-lg);
  background: var(--aimd-interactive-primary);
  color: var(--aimd-text-on-primary);
  box-shadow: var(--aimd-shadow-popover, var(--aimd-shadow-lg));
  font-family: var(--aimd-font-family-sans);
  font-size: var(--aimd-font-size-xs);
  line-height: 1.4;
  letter-spacing: 0;
  pointer-events: none;
  z-index: var(--aimd-z-tooltip);
  opacity: 0;
  transform: translate(-50%, -6px);
  transition: opacity var(--aimd-duration-fast) var(--aimd-ease-in-out),
              transform var(--aimd-duration-fast) var(--aimd-ease-in-out);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  white-space: normal;
}
.aimd-tooltip[data-open="1"] {
  opacity: 1;
  transform: translate(-50%, -12px);
}
.aimd-tooltip[data-variant="preview"] {
  padding: var(--aimd-space-2) var(--aimd-space-3);
}
.aimd-tooltip__title {
  display: block;
  font-size: 18px;
  font-weight: var(--aimd-font-semibold);
  line-height: 1.1;
  margin-bottom: 6px;
}
.aimd-tooltip__body {
  display: block;
  font-size: var(--aimd-font-size-sm);
  line-height: 1.4;
}
.aimd-tooltip[data-variant="label"] .aimd-tooltip__body,
.aimd-tooltip[data-variant="ephemeral"] .aimd-tooltip__body {
  font-size: var(--aimd-font-size-xs);
  font-weight: var(--aimd-font-semibold);
  white-space: nowrap;
}
.aimd-tooltip[data-variant="ephemeral"] {
  animation: aimdTooltipFadeOut 1.5s forwards;
}
@keyframes aimdTooltipFadeOut {
  0% { opacity: 1; transform: translate(-50%, calc(-100% - var(--aimd-space-2))) translateY(0); }
  100% { opacity: 0; transform: translate(-50%, calc(-100% - var(--aimd-space-2))) translateY(calc(-1 * var(--aimd-space-2))); }
}
`;
}

function getStyleHost(root: ShadowRoot | Document): ShadowRoot | HTMLHeadElement | HTMLElement | null {
    if (root instanceof ShadowRoot) return root;
    return document.head || document.documentElement;
}

function ensureTooltipStyle(root: ShadowRoot | Document): void {
    if (root instanceof ShadowRoot) {
        if (root.querySelector(`style[${SHADOW_STYLE_MARK}]`)) return;
        const style = document.createElement('style');
        style.setAttribute(SHADOW_STYLE_MARK, '1');
        style.textContent = getTooltipCss();
        root.appendChild(style);
        return;
    }

    if (document.getElementById(DOC_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DOC_STYLE_ID;
    style.textContent = getTooltipCss();
    getStyleHost(root)?.appendChild(style);
}

function getTooltipLayer(root: ShadowRoot | Document): ParentNode {
    return root instanceof ShadowRoot ? root : document.body;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function truncatePreview(text: string, maxLen: number = 96): string {
    const value = text.trim();
    return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value;
}

function buildTooltipEl(root: ShadowRoot | Document, target: TooltipTarget): HTMLElement | null {
    const bodyText = (target.dataset.tooltip || '').trim();
    if (!bodyText) return null;

    const variant = target.dataset.tooltipVariant || 'label';
    const tooltip = document.createElement('div');
    tooltip.className = 'aimd-tooltip';
    tooltip.dataset.open = '0';
    tooltip.dataset.variant = variant;

    const titleText = (target.dataset.tooltipTitle || '').trim();
    if (variant === 'preview' && titleText) {
        const title = document.createElement('span');
        title.className = 'aimd-tooltip__title';
        title.textContent = titleText;
        tooltip.appendChild(title);
    }

    const body = document.createElement('span');
    body.className = 'aimd-tooltip__body';
    body.textContent = variant === 'preview' ? truncatePreview(bodyText) : bodyText;
    tooltip.appendChild(body);

    getTooltipLayer(root).appendChild(tooltip);
    return tooltip;
}

function isOwnedTooltipNode(node: HTMLElement): boolean {
    if (node.id.startsWith('aimd-')) return true;
    if (node.hasAttribute('data-aimd-role') || node.hasAttribute('data-aimd-theme')) return true;
    return Array.from(node.classList).some((cls) => cls.startsWith('aimd-'));
}

function findTooltipTarget(node: EventTarget | null, boundary: ShadowRoot | Document): TooltipTarget | null {
    const el = node instanceof HTMLElement ? node : null;
    if (!el) return null;
    const target = el.closest<HTMLElement>('[data-tooltip], [data-tooltip-title]');
    if (!target) return null;
    if (boundary instanceof ShadowRoot && !boundary.contains(target)) return null;
    return target as TooltipTarget;
}

export function upgradeTitleTooltips(root: ParentNode): void {
    const candidates: HTMLElement[] = [];
    if (root instanceof HTMLElement && root.hasAttribute('title')) candidates.push(root);
    root.querySelectorAll<HTMLElement>('[title]').forEach((el) => candidates.push(el));

    candidates.forEach((el) => {
        if (!(root instanceof ShadowRoot) && !isOwnedTooltipNode(el) && !el.closest('[data-aimd-role], [data-aimd-theme], [id^="aimd-"], [class*="aimd-"]')) {
            return;
        }
        const title = el.getAttribute('title');
        if (!title) return;
        if (!el.dataset.tooltip) el.dataset.tooltip = title;
        el.removeAttribute('title');
    });
}

export class TooltipDelegate {
    private root: ShadowRoot | Document;
    private delayMs: number;
    private timer: number | null = null;
    private activeTarget: TooltipTarget | null = null;
    private tooltipEl: HTMLElement | null = null;
    private observer: MutationObserver | null = null;
    private onPointerOver: (e: Event) => void;
    private onPointerOut: (e: Event) => void;
    private onFocusIn: (e: Event) => void;
    private onFocusOut: (e: Event) => void;
    private onPointerDown: () => void;

    constructor(root: ShadowRoot | Document, opts?: { delayMs?: number }) {
        this.root = root;
        this.delayMs = opts?.delayMs ?? 150;
        ensureTooltipStyle(root);
        this.onPointerOver = (e) => this.handlePointerOver(e);
        this.onPointerOut = (e) => this.handlePointerOut(e);
        this.onFocusIn = (e) => this.handleFocusIn(e);
        this.onFocusOut = (e) => this.handleFocusOut(e);
        this.onPointerDown = () => this.hide();

        root.addEventListener('pointerover', this.onPointerOver, true);
        root.addEventListener('pointerout', this.onPointerOut, true);
        root.addEventListener('focusin', this.onFocusIn, true);
        root.addEventListener('focusout', this.onFocusOut, true);
        root.addEventListener('pointerdown', this.onPointerDown, true);
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        this.refresh(node);
                    }
                });
            }
        });
        const observedRoot = root instanceof ShadowRoot ? root : document.body;
        if (observedRoot) {
            this.observer.observe(observedRoot, { childList: true, subtree: true });
        }
    }

    refresh(scope?: ParentNode): void {
        upgradeTitleTooltips(scope ?? (this.root instanceof ShadowRoot ? this.root : document.body));
    }

    disconnect(): void {
        this.hide();
        this.root.removeEventListener('pointerover', this.onPointerOver, true);
        this.root.removeEventListener('pointerout', this.onPointerOut, true);
        this.root.removeEventListener('focusin', this.onFocusIn, true);
        this.root.removeEventListener('focusout', this.onFocusOut, true);
        this.root.removeEventListener('pointerdown', this.onPointerDown, true);
        this.observer?.disconnect();
        this.observer = null;
    }

    private handlePointerOver(e: Event): void {
        const target = findTooltipTarget(e.target, this.root);
        if (!target) return;
        this.schedule(target);
    }

    private handlePointerOut(e: Event): void {
        const target = findTooltipTarget(e.target, this.root);
        if (!target || target !== this.activeTarget) return;
        const next = typeof PointerEvent !== 'undefined' && e instanceof PointerEvent ? (e.relatedTarget as Node | null) : null;
        if (next && target.contains(next)) return;
        this.hide();
    }

    private handleFocusIn(e: Event): void {
        const target = findTooltipTarget(e.target, this.root);
        if (!target) return;
        this.schedule(target, 0);
    }

    private handleFocusOut(e: Event): void {
        const target = findTooltipTarget(e.target, this.root);
        if (!target || target !== this.activeTarget) return;
        this.hide();
    }

    private schedule(target: TooltipTarget, delayOverride?: number): void {
        this.clearTimer();
        this.activeTarget = target;
        const delay = delayOverride ?? this.delayMs;
        this.timer = window.setTimeout(() => this.show(target), delay);
    }

    private show(target: TooltipTarget): void {
        this.hideTooltipOnly();
        const tooltip = buildTooltipEl(this.root, target);
        if (!tooltip) return;
        this.tooltipEl = tooltip;

        const rect = target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${Math.max(12, rect.top)}px`;

        const width = tooltip.offsetWidth || 260;
        const half = width / 2;
        const clampedLeft = clamp(rect.left + rect.width / 2, 12 + half, window.innerWidth - 12 - half);
        tooltip.style.left = `${clampedLeft}px`;

        window.requestAnimationFrame(() => {
            if (tooltip === this.tooltipEl) tooltip.dataset.open = '1';
        });
    }

    hide(): void {
        this.clearTimer();
        this.activeTarget = null;
        this.hideTooltipOnly();
    }

    private hideTooltipOnly(): void {
        this.tooltipEl?.remove();
        this.tooltipEl = null;
    }

    private clearTimer(): void {
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
    }
}

let documentTooltipDelegate: TooltipDelegate | null = null;

export function getDocumentTooltipDelegate(): TooltipDelegate {
    if (!documentTooltipDelegate) {
        documentTooltipDelegate = new TooltipDelegate(document);
    }
    return documentTooltipDelegate;
}

export function showEphemeralTooltip(params: {
    root?: ShadowRoot | Document;
    anchor: HTMLElement;
    text: string;
    durationMs?: number;
}): void {
    const root = params.root ?? document;
    ensureTooltipStyle(root);

    const tooltip = document.createElement('div');
    tooltip.className = 'aimd-tooltip';
    tooltip.dataset.variant = 'ephemeral';
    tooltip.dataset.open = '1';
    const body = document.createElement('span');
    body.className = 'aimd-tooltip__body';
    body.textContent = params.text;
    tooltip.appendChild(body);

    const rect = params.anchor.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
    getTooltipLayer(root).appendChild(tooltip);

    window.setTimeout(() => {
        tooltip.remove();
    }, params.durationMs ?? 1500);
}
