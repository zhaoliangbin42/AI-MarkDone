import { omitMarkdownImages } from '../../core/content/chatgptMarkdownCleanup';
import type { RichContentImageV1 } from '../../contracts/richContent';
import { prepareRichContentAssets, resolveRichContentMessageRoot, type RichContentAssetsLease, type RichContentPreparedAsset } from '../../drivers/content/export/richContentAssets';
import { throwIfAborted } from '../../drivers/content/export/renderControl';
import { projectRichContentMarkdown } from '../content/richContentProjection';
import { selectMessageExportPositions } from './messageExportDocument';
import type { ChatTurn, ExportProgressCallback } from './saveMessagesTypes';

export type RichOutputManifest = {
    schemaVersion: 1;
    blocks: Array<{
        sourceIndex: number;
        messageId?: string;
        blockId: string;
        label: string;
        visualDigest: string;
        outcome: 'included' | 'placeholder';
        reason?: string;
        files: Array<{ path: string; mimeType: string; byteLength: number }>;
    }>;
};

export type PreparedRichOutput = {
    turns: ChatTurn[];
    files: Array<{ filename: string; blob: Blob }>;
    manifest: RichOutputManifest;
    release(): void;
};

export function projectRichFallback(markdown: string, turn: Pick<ChatTurn, 'richBlocks'>): string {
    if (!markdown.includes('aimd-rich:')) return markdown;
    const result = projectRichContentMarkdown(markdown, turn.richBlocks ?? []);
    if (result.status !== 'ready' || result.kind !== 'rich-content') throw new Error('Rich content projection is unavailable.');
    return result.markdown;
}

/** Freeze one selection before asynchronous resources; no live body replaces it. */
export async function prepareRichOutput(
    turns: ChatTurn[], selected: readonly number[],
    options: { target: 'archive' | 'visual'; visuals: 'include' | 'placeholder'; signal?: AbortSignal; onProgress?: ExportProgressCallback },
): Promise<PreparedRichOutput> {
    const prepared = turns.map(turn => ({ ...turn }));
    const leases: RichContentAssetsLease[] = [];
    const files: PreparedRichOutput['files'] = [];
    const manifest: RichOutputManifest = { schemaVersion: 1, blocks: [] };
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        leases.forEach(lease => lease.release());
    };
    const positions = selectMessageExportPositions(turns, selected);
    const total = positions.reduce((sum, position) => sum + (turns[position]!.richBlocks?.length ?? 0), 0);
    const deadline = Date.now() + 30_000;
    let completed = 0;
    let captured = 0;
    let byteCount = 0;
    try {
        for (const position of positions) {
            throwIfAborted(options.signal);
            const turn = prepared[position]!;
            if (options.visuals === 'placeholder') {
                turn.user = omitMarkdownImages(turn.user);
                turn.assistant = omitMarkdownImages(turn.assistant, true);
                turn.richImages = [];
            }
            const blocks = turn.richBlocks ?? [];
            if (!blocks.length) { turn.assistant = projectRichFallback(turn.assistant, turn); continue; }
            let assets: readonly RichContentPreparedAsset[] = [];
            let failures: RichContentAssetsLease['failures'] = [];
            if (options.visuals === 'include' && captured < 64 && Date.now() < deadline) {
                const requested = blocks.slice(0, Math.max(0, 64 - captured));
                const lease = await prepareRichContentAssets(requested, {
                    messageId: turn.messageId, documentUrl: turn.documentUrl,
                    resolveMessageRoot: () => resolveRichContentMessageRoot({ messageId: turn.messageId, documentUrl: turn.documentUrl }),
                    signal: options.signal, timeoutMs: Math.min(5_000, Math.max(100, deadline - Date.now())),
                    deadlineMs: deadline,
                    onProgress: progress => options.onProgress?.({ phase: 'preparing', completed: completed + progress.completed, total }),
                });
                const nextBytes = lease.assets.reduce((sum, asset) => sum + asset.blob.size, 0);
                captured += requested.length;
                if (byteCount + nextBytes <= 24 * 1024 * 1024) {
                    leases.push(lease); assets = lease.assets; failures = lease.failures; byteCount += nextBytes;
                } else lease.release();
            }
            const images: RichContentImageV1[] = [];
            const replacements: Array<{ id: string; markdown: string }> = [];
            for (const block of blocks) {
                const variants = assets.filter(asset => asset.blockId === block.id && asset.visualDigest === block.visualDigest);
                const preferred = variants.find(asset => asset.mimeType === 'image/png') ?? variants[0];
                const blockFiles: RichOutputManifest['blocks'][number]['files'] = [];
                if (preferred) {
                    images.push({ blockId: block.id, url: preferred.objectUrl, mimeType: preferred.mimeType });
                    for (const variant of variants) {
                        const path = `assets/m${position + 1}-b${blockFiles.length + 1}-${files.length + 1}.${variant.mimeType === 'image/svg+xml' ? 'svg' : 'png'}`;
                        files.push({ filename: path, blob: variant.blob });
                        blockFiles.push({ path, mimeType: variant.mimeType, byteLength: variant.blob.size });
                        if (variant === preferred) replacements.push({ id: block.id, markdown: `![${escapeImageLabel(block.label)}](${path})` });
                    }
                }
                manifest.blocks.push({
                    sourceIndex: turn.index, ...(turn.messageId ? { messageId: turn.messageId } : {}),
                    blockId: block.id, label: block.label, visualDigest: block.visualDigest,
                    outcome: preferred ? 'included' : 'placeholder',
                    ...(!preferred ? { reason: options.visuals === 'placeholder' ? 'policy-placeholder'
                        : failures.find(failure => failure.blockId === block.id)?.reason ?? 'limit-exceeded' } : {}),
                    files: blockFiles,
                });
            }
            turn.richImages = images;
            if (options.target === 'archive') {
                const projection = projectRichContentMarkdown(turn.assistant, blocks, { replacements });
                if (projection.status !== 'ready' || projection.kind !== 'rich-content') throw new Error('Rich archive projection is unavailable.');
                turn.assistant = projection.markdown;
            } else if (options.visuals === 'placeholder') turn.assistant = projectRichFallback(turn.assistant, turn);
            completed += blocks.length;
            options.onProgress?.({ phase: 'preparing', completed, total });
        }
        throwIfAborted(options.signal);
        return { turns: prepared, files, manifest, release };
    } catch (error) { release(); throw error; }
}

function escapeImageLabel(label: string): string {
    return label.replace(/[\\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
}
