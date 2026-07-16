import { getContenteditableCaretClientRect } from '../../../core/sending/contenteditable';
import type { SurfacePositioner } from '../components/SurfaceRuntime';
import type { PromptWorkflowMode } from './PromptWorkflow';

type ComposerInput = HTMLElement | HTMLTextAreaElement | HTMLInputElement;

export type PromptPlacement = { left: number; top: number };

export type PromptGeometryLayout = {
    mode: Exclude<PromptWorkflowMode, null>;
    host: HTMLElement;
    root: HTMLElement;
    anchor: HTMLElement | null;
    promptCount: number;
    hasStatus: boolean;
};

const POPOVER_MARGIN_PX = 16;
const POPOVER_GAP_PX = 8;
const AUTOCOMPLETE_WIDTH_PX = 420;
const MANAGER_WIDTH_PX = 520;
const AUTOCOMPLETE_FALLBACK_HEIGHT_PX = 220;
const MANAGER_FIXED_HEIGHT_PX = 112;
const MANAGER_ROW_HEIGHT_PX = 64;
const MANAGER_STATUS_HEIGHT_PX = 36;
const MANAGER_MAX_HEIGHT_PX = 630;
const EDITOR_FALLBACK_HEIGHT_PX = 560;
const POPOVER_MIN_MAX_HEIGHT_PX = 180;
const TEXTAREA_CARET_MARKER = '\u200b';

type ViewportFrame = {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
};

/**
 * Host-geometry adapter for the Prompt family. It hides textarea/contenteditable
 * caret differences, viewport collision, session-local panel placement, and
 * pointer-drag cleanup behind one interface.
 */
export class PromptGeometryAdapter {
    private _managerPlacement: PromptPlacement | null = null;
    private panelDragCleanup: (() => void) | null = null;
    private listDragCleanup: (() => void) | null = null;

    constructor(private readonly getComposer: () => ComposerInput | null) {}

    get managerPlacement(): PromptPlacement | null {
        return this._managerPlacement ? { ...this._managerPlacement } : null;
    }

    setManagerPlacement(placement: PromptPlacement | null): void {
        this._managerPlacement = placement ? { ...placement } : null;
    }

    position(layout: PromptGeometryLayout): void {
        if (layout.mode !== 'autocomplete' && this._managerPlacement) {
            this._managerPlacement = this.applyManagerPlacement(layout, this._managerPlacement);
            return;
        }
        if (layout.mode === 'autocomplete') {
            this.positionAutocomplete(layout);
            return;
        }
        this.positionNear(layout, layout.anchor ?? this.getComposer(), 'above');
    }

    createPositioner(getLayout: () => PromptGeometryLayout | null): SurfacePositioner {
        const onViewportChange = () => {
            const layout = getLayout();
            if (layout) this.position(layout);
        };
        const visualViewport = window.visualViewport;
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, { capture: true });
        visualViewport?.addEventListener('resize', onViewportChange);
        visualViewport?.addEventListener('scroll', onViewportChange);
        return {
            update: onViewportChange,
            destroy: () => {
                window.removeEventListener('resize', onViewportChange);
                window.removeEventListener('scroll', onViewportChange, { capture: true } as any);
                visualViewport?.removeEventListener('resize', onViewportChange);
                visualViewport?.removeEventListener('scroll', onViewportChange);
            },
        };
    }

    startPanelDrag(event: PointerEvent, layout: Omit<PromptGeometryLayout, 'anchor'>): void {
        if (layout.mode === 'autocomplete' || event.button !== 0 || this.isPanelDragExcluded(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        this.panelDragCleanup?.();

        const start = this.readCurrentPlacement(layout.host);
        const priorPlacement = this._managerPlacement;
        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;
        const fullLayout: PromptGeometryLayout = { ...layout, anchor: null };
        const onMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            moved = true;
            this._managerPlacement = this.applyManagerPlacement(fullLayout, {
                left: start.left + (moveEvent.clientX - startX),
                top: start.top + (moveEvent.clientY - startY),
            });
        };
        const onEnd = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            document.removeEventListener('pointercancel', onEnd);
            this.panelDragCleanup = null;
            if (!moved) this._managerPlacement = priorPlacement;
        };
        this.panelDragCleanup = onEnd;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd, { once: true });
        document.addEventListener('pointercancel', onEnd, { once: true });
    }

    startListDrag(event: PointerEvent, params: {
        sourceId: string;
        getTargetIdAt: (clientY: number) => string | null;
        onTarget: (targetId: string) => void;
        onEnd: (moved: boolean) => void;
    }): void {
        if (!params.sourceId) return;
        event.preventDefault();
        event.stopPropagation();
        this.listDragCleanup?.();
        let moved = false;
        const onMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            const targetId = params.getTargetIdAt(moveEvent.clientY);
            if (!targetId || targetId === params.sourceId) return;
            moved = true;
            params.onTarget(targetId);
        };
        const onEnd = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onEnd);
            document.removeEventListener('pointercancel', onEnd);
            this.listDragCleanup = null;
            params.onEnd(moved);
        };
        this.listDragCleanup = onEnd;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd, { once: true });
        document.addEventListener('pointercancel', onEnd, { once: true });
    }

    destroyTransient(): void {
        this.panelDragCleanup?.();
        this.panelDragCleanup = null;
        this.listDragCleanup?.();
        this.listDragCleanup = null;
    }

    private positionAutocomplete(layout: PromptGeometryLayout): void {
        const geometry = this.applyPopoverGeometry(layout);
        const caretRect = this.getCaretClientRect();
        if (!caretRect) {
            this.positionNear(layout, this.getComposer(), 'above');
            return;
        }
        const viewport = this.getViewportFrame();
        const measuredHeight = layout.root.getBoundingClientRect().height;
        const height = measuredHeight > 0 ? measuredHeight : AUTOCOMPLETE_FALLBACK_HEIGHT_PX;
        const minLeft = viewport.left + POPOVER_MARGIN_PX;
        const minTop = viewport.top + POPOVER_MARGIN_PX;
        const maxLeft = Math.max(minLeft, viewport.right - geometry.width - POPOVER_MARGIN_PX);
        const left = Math.max(minLeft, Math.min(caretRect.left, maxLeft));
        const aboveTop = caretRect.top - height - POPOVER_GAP_PX;
        const belowTop = caretRect.bottom + POPOVER_GAP_PX;
        const preferredTop = aboveTop >= minTop ? aboveTop : belowTop;
        const maxTop = Math.max(minTop, viewport.bottom - height - POPOVER_MARGIN_PX);
        layout.host.style.left = `${Math.max(minLeft, Math.min(left, maxLeft))}px`;
        layout.host.style.top = `${Math.max(minTop, Math.min(preferredTop, maxTop))}px`;
    }

    private positionNear(
        layout: PromptGeometryLayout,
        anchor: HTMLElement | null,
        preferred: 'above' | 'below',
    ): void {
        const { width, height } = this.applyPopoverGeometry(layout);
        const viewport = this.getViewportFrame();
        const rect = anchor?.getBoundingClientRect?.();
        const fallbackLeft = Math.max(viewport.left + POPOVER_MARGIN_PX, viewport.right - width - POPOVER_MARGIN_PX);
        const fallbackTop = Math.max(viewport.top + POPOVER_MARGIN_PX, viewport.bottom - height - (POPOVER_MARGIN_PX * 4));
        if (!rect) {
            layout.host.style.left = `${fallbackLeft}px`;
            layout.host.style.top = `${fallbackTop}px`;
            return;
        }
        const rawLeft = layout.mode === 'autocomplete' ? rect.left : rect.right - width;
        const maxLeft = Math.max(viewport.left + POPOVER_MARGIN_PX, viewport.right - width - POPOVER_MARGIN_PX);
        const left = Math.max(viewport.left + POPOVER_MARGIN_PX, Math.min(rawLeft, maxLeft));
        const aboveTop = rect.top - height - POPOVER_GAP_PX;
        const belowTop = rect.bottom + POPOVER_GAP_PX;
        const spaceAbove = rect.top - viewport.top - POPOVER_MARGIN_PX;
        const spaceBelow = viewport.bottom - rect.bottom - POPOVER_MARGIN_PX;
        const preferredTop = preferred === 'above'
            ? (aboveTop >= viewport.top + POPOVER_MARGIN_PX || spaceAbove >= spaceBelow ? aboveTop : belowTop)
            : (belowTop + height <= viewport.bottom - POPOVER_MARGIN_PX || spaceBelow >= spaceAbove ? belowTop : aboveTop);
        const placement = this.clampPlacement({ left, top: preferredTop }, width, height);
        layout.host.style.left = `${placement.left}px`;
        layout.host.style.top = `${placement.top}px`;
    }

    private resolvePopoverGeometry(layout: PromptGeometryLayout): { width: number; height: number; maxHeight: number } {
        const viewport = this.getViewportFrame();
        const preferredWidth = layout.mode === 'autocomplete' ? AUTOCOMPLETE_WIDTH_PX : MANAGER_WIDTH_PX;
        const availableWidth = Math.max(0, viewport.width - (POPOVER_MARGIN_PX * 2));
        const width = Math.min(preferredWidth, availableWidth);
        const viewportMaxHeight = Math.max(POPOVER_MIN_MAX_HEIGHT_PX, viewport.height - (POPOVER_MARGIN_PX * 2));
        const maxHeight = layout.mode === 'autocomplete'
            ? viewportMaxHeight
            : Math.min(MANAGER_MAX_HEIGHT_PX, viewportMaxHeight);
        const measuredHeight = layout.root.getBoundingClientRect().height;
        const fallbackHeight = this.estimateHeight(layout, maxHeight);
        const height = Math.min(maxHeight, Math.max(measuredHeight, fallbackHeight));
        return { width, height, maxHeight };
    }

    private applyPopoverGeometry(layout: PromptGeometryLayout): { width: number; height: number; maxHeight: number } {
        const geometry = this.resolvePopoverGeometry(layout);
        layout.host.style.width = `${geometry.width}px`;
        layout.host.style.setProperty('--_prompt-popover-max-height', `${geometry.maxHeight}px`);
        return geometry;
    }

    private applyManagerPlacement(layout: PromptGeometryLayout, placement: PromptPlacement): PromptPlacement {
        const { width, height } = this.applyPopoverGeometry(layout);
        const clamped = this.clampPlacement(placement, width, height);
        layout.host.style.left = `${clamped.left}px`;
        layout.host.style.top = `${clamped.top}px`;
        return clamped;
    }

    private clampPlacement(placement: PromptPlacement, width: number, height: number): PromptPlacement {
        const viewport = this.getViewportFrame();
        const minLeft = viewport.left + POPOVER_MARGIN_PX;
        const minTop = viewport.top + POPOVER_MARGIN_PX;
        const maxLeft = Math.max(minLeft, viewport.right - width - POPOVER_MARGIN_PX);
        const maxTop = Math.max(minTop, viewport.bottom - height - POPOVER_MARGIN_PX);
        return {
            left: Math.round(Math.max(minLeft, Math.min(placement.left, maxLeft))),
            top: Math.round(Math.max(minTop, Math.min(placement.top, maxTop))),
        };
    }

    private getViewportFrame(): ViewportFrame {
        const visual = window.visualViewport;
        const left = Number.isFinite(visual?.offsetLeft) ? visual!.offsetLeft : 0;
        const top = Number.isFinite(visual?.offsetTop) ? visual!.offsetTop : 0;
        const width = Math.max(0, Number.isFinite(visual?.width)
            ? visual!.width
            : (window.innerWidth || document.documentElement.clientWidth || 0));
        const height = Math.max(0, Number.isFinite(visual?.height)
            ? visual!.height
            : (window.innerHeight || document.documentElement.clientHeight || 0));
        return { left, top, width, height, right: left + width, bottom: top + height };
    }

    private estimateHeight(layout: PromptGeometryLayout, maxHeight: number): number {
        if (layout.mode === 'autocomplete') return Math.min(maxHeight, AUTOCOMPLETE_FALLBACK_HEIGHT_PX);
        if (layout.mode === 'edit') return Math.min(maxHeight, EDITOR_FALLBACK_HEIGHT_PX);
        const rowCount = Math.max(1, layout.promptCount);
        const statusHeight = layout.hasStatus ? MANAGER_STATUS_HEIGHT_PX : 0;
        return Math.min(maxHeight, MANAGER_FIXED_HEIGHT_PX + statusHeight + (rowCount * MANAGER_ROW_HEIGHT_PX));
    }

    private readCurrentPlacement(host: HTMLElement): PromptPlacement {
        const rect = host.getBoundingClientRect();
        const left = Number.parseFloat(host.style.left);
        const top = Number.parseFloat(host.style.top);
        return {
            left: Number.isFinite(left) ? left : rect.left,
            top: Number.isFinite(top) ? top : rect.top,
        };
    }

    private isPanelDragExcluded(target: EventTarget | null): boolean {
        if (!(target instanceof Element)) return false;
        return Boolean(target.closest(
            'button, input, textarea, select, [contenteditable="true"], [data-action="reorder-prompt"], .prompt-drag-handle',
        ));
    }

    private getCaretClientRect(): DOMRect | null {
        const input = this.getComposer();
        if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
            return this.getTextInputCaretClientRect(input);
        }
        if (input instanceof HTMLElement && (input.isContentEditable || input.getAttribute('contenteditable') === 'true')) {
            return getContenteditableCaretClientRect(input);
        }
        return null;
    }

    private getTextInputCaretClientRect(input: HTMLTextAreaElement | HTMLInputElement): DOMRect | null {
        const position = input.selectionStart ?? input.value.length;
        const rect = input.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const style = window.getComputedStyle(input);
        const mirror = document.createElement('div');
        const marker = document.createElement('span');
        const copyProperties = [
            'boxSizing', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontFamily', 'fontSize',
            'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'textIndent',
            'textAlign', 'tabSize', 'wordBreak',
        ] as const;
        mirror.style.position = 'fixed';
        mirror.style.left = '0';
        mirror.style.top = '0';
        mirror.style.width = `${rect.width}px`;
        mirror.style.height = 'auto';
        mirror.style.visibility = 'hidden';
        mirror.style.pointerEvents = 'none';
        mirror.style.whiteSpace = input instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.overflow = 'hidden';
        copyProperties.forEach((property) => {
            mirror.style[property] = style[property];
        });
        mirror.textContent = input.value.slice(0, position);
        marker.dataset.aimdTextareaCaret = '1';
        marker.textContent = TEXTAREA_CARET_MARKER;
        mirror.appendChild(marker);
        document.body.appendChild(mirror);
        const markerLeft = marker.offsetLeft;
        const markerTop = marker.offsetTop;
        mirror.remove();
        const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) || 16;
        const left = rect.left + markerLeft - input.scrollLeft;
        const top = rect.top + markerTop - input.scrollTop;
        return {
            x: left, y: top, left, top, width: 0, height: lineHeight,
            right: left, bottom: top + lineHeight, toJSON: () => ({}),
        } as DOMRect;
    }
}
