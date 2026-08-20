import type { ConversationMaterializationPortV1 } from '../../../contracts/conversationMaterialization';
import {
    type ContentSurfaceAdapter,
    type ContentSurfaceSelectionLocation,
} from '../../../drivers/content/adapters/ContentSurfaceAdapter';
import {
    collectRenderedAtomicUnitCandidatesForRange,
    resolveSelectedRenderedAtomicUnitsFromCandidates,
    type RenderedAtomicUnit,
} from '../../../services/reader/atomicSelection';
import { emitContentPerformanceEvent } from '../../../drivers/content/performanceDiagnostics';

export type ChatGPTPageSelectionFrame = Readonly<{
    revision: number;
    location: ContentSurfaceSelectionLocation;
    renderedAtomicUnits: RenderedAtomicUnit[];
}>;

export type ChatGPTPageSelectionListener = (frame: ChatGPTPageSelectionFrame | null) => void;

export type ChatGPTPageSelectionCoordinatorOptions = Readonly<{
    surfaceAdapter: ContentSurfaceAdapter;
    materialization?: ConversationMaterializationPortV1 | null;
    resolveRenderedAtomicUnits?: (location: ContentSurfaceSelectionLocation) => RenderedAtomicUnit[];
}>;

/**
 * The sole page-level selection owner for rendered ChatGPT content.
 *
 * Selection events are intentionally reduced to a cheap DOM location once per
 * animation frame. Semantic quote/formula evidence is materialized by the
 * action owner (copy/comment) through PageMarkdownSelectionResolver.
 */
export class ChatGPTPageSelectionCoordinator {
    private initialized = false;
    private rafId: number | null = null;
    private revision = 0;
    private frame: ChatGPTPageSelectionFrame | null = null;
    private readonly listeners = new Set<ChatGPTPageSelectionListener>();
    private renderedUnitCandidates = new WeakMap<HTMLElement, WeakMap<Node, HTMLElement[]>>();
    private unsubscribeMaterialization: (() => void) | null = null;

    constructor(private readonly options: ChatGPTPageSelectionCoordinatorOptions) {
    }

    init(): void {
        if (this.initialized) return;
        this.initialized = true;
        document.addEventListener('selectionchange', this.handleSelectionChange);
        if (this.options.materialization) {
            this.unsubscribeMaterialization = this.options.materialization.subscribe(this.handleMaterializationChanged);
        }
    }

    dispose(): void {
        if (!this.initialized) return;
        this.initialized = false;
        document.removeEventListener('selectionchange', this.handleSelectionChange);
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.unsubscribeMaterialization?.();
        this.unsubscribeMaterialization = null;
        this.clearFrame();
        this.renderedUnitCandidates = new WeakMap<HTMLElement, WeakMap<Node, HTMLElement[]>>();
        this.listeners.clear();
    }

    subscribe(listener: ChatGPTPageSelectionListener): () => void {
        this.listeners.add(listener);
        if (this.frame) listener(this.frame);
        return () => this.listeners.delete(listener);
    }

    getCurrentFrame(): ChatGPTPageSelectionFrame | null {
        if (!this.frame) return null;
        const { location } = this.frame;
        if (!location.root.isConnected || !location.messageElement.isConnected) {
            this.clearFrame();
            return null;
        }
        return this.frame;
    }

    /** Cancel a pending frame and perform one final cheap location pass. */
    refreshNow(): ChatGPTPageSelectionFrame | null {
        if (this.rafId !== null) {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        return this.publishCurrentSelection();
    }

    private readonly handleSelectionChange = (): void => {
        if (!this.initialized || this.rafId !== null) return;
        this.rafId = window.requestAnimationFrame(() => {
            this.rafId = null;
            this.publishCurrentSelection();
        });
    };

    private readonly handleMaterializationChanged = (): void => {
        // A materialization/content token transition invalidates all DOM
        // references held by the transient frame. Do not carry a stale Range
        // into a copy/comment action after a host remount.
        if (this.frame) this.clearFrame();
        this.renderedUnitCandidates = new WeakMap<HTMLElement, WeakMap<Node, HTMLElement[]>>();
    };

    private publishCurrentSelection(): ChatGPTPageSelectionFrame | null {
        const startedAt = performance.now();
        const location = this.options.surfaceAdapter.locateSelection(window.getSelection());
        if (!location) {
            this.clearFrame();
            emitContentPerformanceEvent({
                kind: 'selection-frame',
                durationMs: performance.now() - startedAt,
                locateCalls: 1,
            });
            return null;
        }
        if (this.frame && sameSelectionLocation(this.frame.location, location)) {
            emitContentPerformanceEvent({
                kind: 'selection-frame',
                durationMs: performance.now() - startedAt,
                locateCalls: 1,
            });
            return this.frame;
        }
        const frame = Object.freeze({
            revision: ++this.revision,
            location,
            renderedAtomicUnits: this.resolveRenderedAtomicUnitsCached(location),
        });
        this.frame = frame;
        this.listeners.forEach((listener) => listener(frame));
        emitContentPerformanceEvent({
            kind: 'selection-frame',
            durationMs: performance.now() - startedAt,
            locateCalls: 1,
        });
        return frame;
    }

    private resolveRenderedAtomicUnitsCached(location: ContentSurfaceSelectionLocation): RenderedAtomicUnit[] {
        if (this.options.resolveRenderedAtomicUnits) return this.options.resolveRenderedAtomicUnits(location);
        let byAncestor = this.renderedUnitCandidates.get(location.root);
        if (!byAncestor) {
            byAncestor = new WeakMap<Node, HTMLElement[]>();
            this.renderedUnitCandidates.set(location.root, byAncestor);
        }
        const ancestor = location.range.commonAncestorContainer;
        let candidates = byAncestor.get(ancestor);
        if (!candidates) {
            candidates = collectRenderedAtomicUnitCandidatesForRange(location.range, location.root);
            byAncestor.set(ancestor, candidates);
        }
        return resolveSelectedRenderedAtomicUnitsFromCandidates(location.range, location.root, candidates);
    }

    private clearFrame(): void {
        if (!this.frame) return;
        this.frame = null;
        this.revision += 1;
        this.listeners.forEach((listener) => listener(null));
    }
}

function sameSelectionLocation(
    left: ContentSurfaceSelectionLocation,
    right: ContentSurfaceSelectionLocation,
): boolean {
    return left.root === right.root
        && left.messageElement === right.messageElement
        && left.range.startContainer === right.range.startContainer
        && left.range.startOffset === right.range.startOffset
        && left.range.endContainer === right.range.endContainer
        && left.range.endOffset === right.range.endOffset;
}
