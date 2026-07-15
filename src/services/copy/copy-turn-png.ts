import { copyImageBlobToClipboard } from '../../drivers/content/clipboard/copyImageToClipboard';
import { downloadBlob } from '../../drivers/content/export/downloadBlob';
import { isRenderAbortError, throwIfAborted } from '../../drivers/content/export/renderControl';
import { zipBlobs } from '../../drivers/content/export/zipBlobs';
import { buildMessageExportDocument } from '../export/messageExportDocument';
import { planMessagePngFilenames } from '../export/messagePngFilenames';
import {
    renderMessageDocumentPng,
    resolveMessagePngOptions,
    type MessagePngRenderSettings,
} from '../export/messagePngRenderer';
import type { ImageExportProgressEvent } from '../export/imageExportContracts';
import type { ChatTurn, ConversationMetadata, TranslateFn } from '../export/saveMessagesTypes';
import { nowMs, type CopyPngDebugSink } from './copy-png-debug';

export type CopyMessagePngResult =
    | { ok: true; noop: boolean; fallback?: 'download' }
    | { ok: false; error: { code: string; message: string }; cancelled?: boolean };

export async function copyMessagePng(
    turn: ChatTurn,
    metadata: ConversationMetadata,
    options: {
        t: TranslateFn;
        png?: MessagePngRenderSettings;
        onDebug?: CopyPngDebugSink;
        onProgress?: (event: ImageExportProgressEvent) => void;
        signal?: AbortSignal;
    },
): Promise<CopyMessagePngResult> {
    const startedAt = nowMs();
    const emit = (event: Parameters<CopyPngDebugSink>[0]) => options.onDebug?.({
        ...event,
        totalMs: Math.round(nowMs() - startedAt),
    });

    try {
        throwIfAborted(options.signal);
        const buildStartedAt = nowMs();
        const document = buildMessageExportDocument([turn], [0], {
            title: metadata.title,
            labels: {
                user: options.t('pdfUserLabel'),
                assistant: options.t('pdfAssistantLabel'),
            },
            formatHeading: (ordinal) => options.t('pdfMessagePrefix', `${ordinal}`),
        });
        if (!document) return { ok: true, noop: true };
        const resolved = resolveMessagePngOptions(options.png);
        emit({
            stage: 'build_document',
            durationMs: Math.round(nowMs() - buildStartedAt),
            selectedCount: 1,
            turnCount: 1,
            sectionCount: document.sections.length,
            assistantChars: turn.assistant.length,
            userChars: turn.user.length,
            width: resolved.widthCssPx,
            pixelRatio: resolved.requestedPixelRatio,
        });

        let bandCount = 0;
        const renderStartedAt = nowMs();
        const artifacts = await renderMessageDocumentPng(document, options.png, {
            signal: options.signal,
            onProgress: (event) => {
                if (event.phase === 'rasterizing' && event.total) bandCount = Math.max(bandCount, event.total);
                options.onProgress?.(event);
            },
        });
        throwIfAborted(options.signal);
        if (artifacts.length === 0) throw new Error('PNG renderer returned no artifacts.');
        const encodedBytes = artifacts.reduce((sum, artifact) => sum + artifact.blob.size, 0);
        emit({
            stage: 'render_artifacts',
            durationMs: Math.round(nowMs() - renderStartedAt),
            blobBytes: encodedBytes,
            encodedBytes,
            artifactCount: artifacts.length,
            bandCount,
            width: artifacts[0]?.metadata.widthPx,
            height: artifacts.reduce((sum, artifact) => sum + artifact.metadata.heightPx, 0),
            requestedPixelRatio: resolved.requestedPixelRatio,
            effectivePixelRatio: artifacts[0]?.metadata.effectivePixelRatio,
        });

        const filenames = planMessagePngFilenames(metadata.title, 1, artifacts.length);
        if (artifacts.length > 1) {
            const files = artifacts.map((artifact, index) => ({
                filename: filenames.artifactFilenames[index]!,
                chunks: artifact.chunks,
            }));
            const zip = await zipBlobs({ files, signal: options.signal });
            throwIfAborted(options.signal);
            downloadBlob({ filename: filenames.zipFilename, blob: zip });
            emit({
                stage: 'copy_done',
                durationMs: Math.round(nowMs() - startedAt),
                result: 'download_multipart',
            });
            return { ok: true, noop: false, fallback: 'download' };
        }

        const artifact = artifacts[0]!;
        const clipboardStartedAt = nowMs();
        throwIfAborted(options.signal);
        const clipboardResult = await copyImageBlobToClipboard(artifact.blob);
        emit({
            stage: 'clipboard_write',
            durationMs: Math.round(nowMs() - clipboardStartedAt),
            blobBytes: artifact.blob.size,
            result: clipboardResult.ok ? 'ok' : clipboardResult.reason,
            errorCode: clipboardResult.ok ? undefined : clipboardResult.errorName,
            errorMessage: clipboardResult.ok ? undefined : clipboardResult.errorMessage,
        });
        if (clipboardResult.ok) {
            emit({ stage: 'copy_done', durationMs: Math.round(nowMs() - startedAt), result: 'ok' });
            return { ok: true, noop: false };
        }

        throwIfAborted(options.signal);
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

        downloadBlob({ filename: filenames.artifactFilenames[0]!, blob: artifact.blob });
        emit({
            stage: 'copy_error',
            durationMs: 0,
            errorCode: clipboardResult.errorName ?? 'CLIPBOARD_WRITE_FAILED',
            errorMessage: clipboardResult.errorMessage ?? options.t('clipboardImageWriteFailed'),
        });
        return { ok: true, noop: false, fallback: 'download' };
    } catch (error: any) {
        if (isRenderAbortError(error)) {
            emit({
                stage: 'copy_error',
                durationMs: 0,
                errorCode: 'CANCELLED',
                errorMessage: options.t('btnCancel'),
            });
            return { ok: false, cancelled: true, error: { code: 'CANCELLED', message: options.t('btnCancel') } };
        }
        emit({ stage: 'copy_error', durationMs: 0, errorMessage: error?.message || String(error) });
        return { ok: false, error: { code: error?.code || 'INTERNAL_ERROR', message: error?.message || options.t('copyFailed') } };
    }
}
