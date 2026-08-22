import type { SiteAdapter } from '../../drivers/content/adapters/base';
import type { ContentSurfaceSelectionCapture } from '../../drivers/content/adapters/ContentSurfaceAdapter';
import type { ContentSurfaceAdapter } from '../../drivers/content/adapters/ContentSurfaceAdapter';
import type { ContentSurfaceSelectionEvidenceV1 } from '../../contracts/contentSurface';
import type { ConversationContentSourceV1 } from '../../contracts/conversationContent';
import type { ConversationMaterializationPortV1 } from '../../contracts/conversationMaterialization';
import type { RenderedAtomicUnit } from '../../services/reader/atomicSelection';
import { buildPageAtomicSelectionSnapshot } from '../../services/copy/atomicSelectionMarkdown';
import { projectSurfaceSelectionToMarkdown } from '../../services/semantic-content/SurfaceProjection';
import type { ChatGPTPageSelectionFrame } from './controllers/ChatGPTPageSelectionCoordinator';
import { emitContentPerformanceEvent } from '../../drivers/content/performanceDiagnostics';

/**
 * The single source of truth for turning a browser selection into canonical
 * Markdown on a page surface. The keyboard shortcut, the floating toolbar copy
 * button, and page annotations must all consume this exact snapshot so the
 * copied Markdown and the annotation's `sourceMarkdown` stay strictly
 * same-source.
 */
export type PageMarkdownSelectionSnapshot = {
    range: Range;
    root: HTMLElement;
    units: RenderedAtomicUnit[];
    canonicalMarkdown: string;
    evidence: ContentSurfaceSelectionEvidenceV1 | null;
};

export type BuildPageMarkdownSelectionSnapshotParams = {
    adapter: SiteAdapter;
    contentSource: ConversationContentSourceV1 | null;
    materialization: ConversationMaterializationPortV1 | null;
    context: ContentSurfaceSelectionCapture;
    units: RenderedAtomicUnit[];
};

export type PageMarkdownSelectionResolverOptions = Readonly<{
    adapter: SiteAdapter;
    contentSource: ConversationContentSourceV1 | null;
    materialization: ConversationMaterializationPortV1 | null;
    surfaceAdapter: ContentSurfaceAdapter;
}>;

/**
 * Materializes canonical selection evidence only at an explicit user action.
 * A revision cache lets Atomic Copy and Page Annotation Copy/Comment share the
 * same projection without introducing another content source.
 */
export class PageMarkdownSelectionResolver {
    private cachedRevision: number | null = null;
    private cachedContext: ContentSurfaceSelectionCapture | null = null;
    private cachedSnapshotRevision: number | null = null;
    private cachedSnapshot: PageMarkdownSelectionSnapshot | null = null;

    constructor(private readonly options: PageMarkdownSelectionResolverOptions) {}

    resolve(frame: ChatGPTPageSelectionFrame | null): PageMarkdownSelectionSnapshot | null {
        if (!frame) {
            this.invalidate();
            return null;
        }
        if (this.cachedSnapshotRevision === frame.revision) return this.cachedSnapshot;
        const context = this.materialize(frame);
        if (!context) {
            this.cachedSnapshotRevision = frame.revision;
            return null;
        }
        const snapshot = buildPageMarkdownSelectionSnapshot({
            adapter: this.options.adapter,
            contentSource: this.options.contentSource,
            materialization: this.options.materialization,
            context,
            units: frame.renderedAtomicUnits,
        });
        emitContentPerformanceEvent({
            kind: 'markdown-projection',
            status: snapshot ? 'ready' : (context.evidence ? 'unavailable' : 'no-evidence'),
        });
        this.cachedSnapshotRevision = frame.revision;
        this.cachedSnapshot = snapshot;
        return snapshot;
    }

    /**
     * Materialize selection evidence at most once for a selection revision.
     * Consumers that only need to decide whether canonical copy is available
     * must use this instead of reaching through the surface adapter directly.
     */
    materialize(frame: ChatGPTPageSelectionFrame | null): ContentSurfaceSelectionCapture | null {
        if (!frame) {
            this.invalidate();
            return null;
        }
        if (this.cachedRevision === frame.revision) return this.cachedContext;
        this.cachedRevision = frame.revision;
        this.cachedContext = this.options.surfaceAdapter.materializeSelection(frame.location);
        this.cachedSnapshotRevision = null;
        this.cachedSnapshot = null;
        return this.cachedContext;
    }

    hasEvidence(frame: ChatGPTPageSelectionFrame | null): boolean {
        return Boolean(this.materialize(frame)?.evidence);
    }

    invalidate(): void {
        this.cachedRevision = null;
        this.cachedContext = null;
        this.cachedSnapshotRevision = null;
        this.cachedSnapshot = null;
    }
}

export function buildPageMarkdownSelectionSnapshot(
    params: BuildPageMarkdownSelectionSnapshotParams,
): PageMarkdownSelectionSnapshot | null {
    const { adapter, contentSource, materialization, context, units } = params;
    if (contentSource && materialization && context.evidence) {
        const semantic = projectSurfaceSelectionToMarkdown({
            source: contentSource,
            materialization,
            evidence: context.evidence,
        });
        if (semantic.status === 'ready') {
            return {
                range: context.range.cloneRange(),
                root: context.root,
                units,
                canonicalMarkdown: semantic.markdown,
                evidence: context.evidence,
            };
        }
    }

    const canonicalMarkdown = buildPageAtomicSelectionSnapshot({
        adapter,
        range: context.range,
        root: context.root,
    })?.canonicalMarkdown ?? '';
    if (!canonicalMarkdown) return null;
    return {
        range: context.range.cloneRange(),
        root: context.root,
        units,
        canonicalMarkdown,
        // Identity evidence remains useful for durable annotation targeting,
        // but live DOM copy/comment eligibility does not depend on pool tokens.
        evidence: context.evidence,
    };
}

export function isPageMarkdownSelectionSnapshotCurrent(snapshot: PageMarkdownSelectionSnapshot): boolean {
    return snapshot.root.isConnected
        && snapshot.range.startContainer.isConnected
        && snapshot.range.endContainer.isConnected
        && snapshot.root.contains(snapshot.range.startContainer)
        && snapshot.root.contains(snapshot.range.endContainer);
}
