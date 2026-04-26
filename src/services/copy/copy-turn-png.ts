import { copyImageBlobToClipboard } from '../../drivers/content/clipboard/copyImageToClipboard';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import { renderPngBlob, type RenderPngMetrics } from '../../drivers/content/export/renderPng';
import { buildPngExportPlans, type BuildPngExportPlanOptions } from '../export/saveMessagesPng';
import type { ChatTurn, ConversationMetadata, TranslateFn } from '../export/saveMessagesTypes';
import { nowMs, type CopyPngDebugSink } from './copy-png-debug';

export type CopyTurnsPngResult =
    | { ok: true; noop: boolean; fallback?: 'download' }
    | { ok: false; error: { code: string; message: string } };

export async function copyTurnsPng(
    turns: ChatTurn[],
    selectedIndices: number[],
    metadata: ConversationMetadata,
    options: {
        t: TranslateFn;
        png?: BuildPngExportPlanOptions;
        onDebug?: CopyPngDebugSink;
    },
): Promise<CopyTurnsPngResult> {
    if (!selectedIndices || selectedIndices.length === 0) return { ok: true, noop: true };

    const startedAt = nowMs();
    const emit = (event: Parameters<CopyPngDebugSink>[0]) => options.onDebug?.({
        ...event,
        totalMs: Math.round(nowMs() - startedAt),
    });

    try {
        const buildPlanStartedAt = nowMs();
        const result = buildPngExportPlans(turns, selectedIndices, metadata, options.t, options.png);
        if (!result || result.plans.length < 1) return { ok: true, noop: true };
        const selectedTurn = turns[selectedIndices[0] ?? -1] ?? null;
        emit({
            stage: 'build_plan',
            durationMs: Math.round(nowMs() - buildPlanStartedAt),
            selectedCount: selectedIndices.length,
            turnCount: turns.length,
            assistantChars: selectedTurn?.assistant.length ?? 0,
            userChars: selectedTurn?.user.length ?? 0,
            htmlChars: result.plans[0]?.html.length ?? 0,
            width: result.options.width,
            pixelRatio: result.options.pixelRatio,
        });
        if (result.plans.length !== 1) {
            return { ok: false, error: { code: 'INVALID_SELECTION', message: options.t('copyFailed') } };
        }

        let renderMetrics: Partial<RenderPngMetrics> = {};
        const renderStartedAt = nowMs();
        const blob = await renderPngBlob({
            ...result.plans[0]!,
            onMetrics: (metrics) => {
                renderMetrics = { ...metrics };
            },
        });
        emit({
            stage: 'render_blob',
            durationMs: Math.round(nowMs() - renderStartedAt),
            blobBytes: blob.size,
            width: renderMetrics?.width,
            height: renderMetrics?.height,
            requestedPixelRatio: renderMetrics?.requestedPixelRatio,
            effectivePixelRatio: renderMetrics?.effectivePixelRatio,
            pixelArea: renderMetrics?.pixelArea,
            capReason: renderMetrics?.capReason,
            fontStatus: renderMetrics?.fontStatus,
            strategy: renderMetrics?.strategy,
            chunkCount: renderMetrics?.chunkCount,
            maxChunkHeight: renderMetrics?.maxChunkHeight,
            fontEmbedMode: renderMetrics?.fontEmbedMode,
        });

        const clipboardStartedAt = nowMs();
        const clipboardResult = await copyImageBlobToClipboard(blob);
        emit({
            stage: 'clipboard_write',
            durationMs: Math.round(nowMs() - clipboardStartedAt),
            blobBytes: blob.size,
            result: clipboardResult.ok ? 'ok' : clipboardResult.reason,
            errorCode: clipboardResult.ok ? undefined : clipboardResult.errorName,
            errorMessage: clipboardResult.ok ? undefined : clipboardResult.errorMessage,
        });
        if (clipboardResult.ok) {
            emit({
                stage: 'copy_done',
                durationMs: Math.round(nowMs() - startedAt),
                result: 'ok',
            });
            return { ok: true, noop: false };
        }

        if (clipboardResult.reason === 'unsupported') {
            emit({
                stage: 'copy_error',
                durationMs: 0,
                errorCode: 'CLIPBOARD_UNSUPPORTED',
                errorMessage: options.t('clipboardImageWriteUnsupported'),
            });
            return {
                ok: false,
                error: { code: 'CLIPBOARD_UNSUPPORTED', message: options.t('clipboardImageWriteUnsupported') },
            };
        }

        downloadBlob({ filename: result.plans[0]!.filename, blob });
        emit({
            stage: 'copy_error',
            durationMs: 0,
            errorCode: clipboardResult.errorName ?? 'CLIPBOARD_WRITE_FAILED',
            errorMessage: clipboardResult.errorMessage ?? options.t('clipboardImageWriteFailed'),
        });
        return { ok: true, noop: false, fallback: 'download' };
    } catch (err: any) {
        emit({
            stage: 'copy_error',
            durationMs: 0,
            errorMessage: err?.message || String(err),
        });
        return { ok: false, error: { code: 'INTERNAL_ERROR', message: err?.message || options.t('copyFailed') } };
    }
}
