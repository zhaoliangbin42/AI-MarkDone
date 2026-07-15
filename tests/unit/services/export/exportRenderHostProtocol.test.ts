import { describe, expect, it } from 'vitest';
import {
    EXPORT_RENDER_HOST_PROTOCOL_VERSION,
    getRenderHostEventTransferables,
    isRenderHostCommand,
    isRenderHostEvent,
} from '@/services/export/exportRenderHostProtocol';

describe('exportRenderHostProtocol', () => {
    it('accepts a complete v1 message PNG job and rejects malformed or unknown-version commands', () => {
        const command = {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'start',
            jobId: 'job-1',
            job: {
                kind: 'message-png',
                document: {
                    schemaVersion: 1,
                    profile: 'message-card-v1',
                    title: 'Conversation',
                    labels: { user: 'You', assistant: 'Assistant' },
                    sections: [{
                        sourceIndex: 7,
                        heading: 'Message 1',
                        userText: 'Question',
                        assistantMarkdown: '**Answer**',
                    }],
                },
                options: {
                    widthCssPx: 800,
                    requestedPixelRatio: 2,
                },
            },
        };

        expect(isRenderHostCommand(command)).toBe(true);
        expect(isRenderHostCommand({ ...command, v: 2 })).toBe(false);
        expect(isRenderHostCommand({
            ...command,
            job: {
                ...command.job,
                document: { ...command.job.document, sections: 'not-an-array' },
            },
        })).toBe(false);
        expect(isRenderHostCommand({
            ...command,
            job: {
                ...command.job,
                document: {
                    ...command.job.document,
                    sections: [{
                        ...command.job.document.sections[0],
                        assistantMarkdown: 'x'.repeat(2_000_001),
                    }],
                },
            },
        })).toBe(false);
    });

    it('accepts formula asset jobs only for supported outputs and complete visual specs', () => {
        const command = {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'start',
            jobId: 'formula-1',
            job: {
                kind: 'formula-asset',
                spec: {
                    source: String.raw`\frac{1}{2}`,
                    displayMode: true,
                    fontSizePx: 36,
                    foregroundColor: 'rgb(23, 23, 23)',
                },
                output: 'svg',
            },
        };

        expect(isRenderHostCommand(command)).toBe(true);
        expect(isRenderHostCommand({
            ...command,
            job: { ...command.job, output: 'pdf' },
        })).toBe(false);
        expect(isRenderHostCommand({
            ...command,
            job: { ...command.job, spec: { ...command.job.spec, foregroundColor: '' } },
        })).toBe(false);
        expect(isRenderHostCommand({
            ...command,
            job: { ...command.job, spec: { ...command.job.spec, source: 'x'.repeat(100_001) } },
        })).toBe(false);
    });

    it('validates cancellation as a versioned command tied to one job', () => {
        expect(isRenderHostCommand({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'cancel',
            jobId: 'job-1',
        })).toBe(true);
        expect(isRenderHostCommand({
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'cancel',
            jobId: '   ',
        })).toBe(false);
    });

    it('accepts binary artifact chunks only as transferable ArrayBuffers', () => {
        const bytes = new Uint8Array([137, 80, 78, 71]).buffer;
        const event = {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            type: 'artifact-chunk',
            jobId: 'job-1',
            sequence: 0,
            bytes,
        };

        expect(isRenderHostEvent(event)).toBe(true);
        expect(getRenderHostEventTransferables(event)).toEqual([bytes]);
        expect(isRenderHostEvent({ ...event, sequence: -1 })).toBe(false);
        expect(isRenderHostEvent({ ...event, bytes: new Uint8Array(bytes) })).toBe(false);
    });

    it('validates progress, artifact lifecycle, and stable failure events', () => {
        const base = {
            v: EXPORT_RENDER_HOST_PROTOCOL_VERSION,
            jobId: 'job-1',
        };
        const progress = { ...base, type: 'progress', phase: 'encoding', completed: 1, total: 2 };
        const artifactStart = {
            ...base,
            type: 'artifact-start',
            metadata: {
                mimeType: 'image/png',
                widthPx: 1600,
                heightPx: 4000,
                effectivePixelRatio: 2,
                partNumber: 1,
                partCount: 1,
            },
        };
        const artifactComplete = { ...base, type: 'artifact-complete' };
        const failed = {
            ...base,
            type: 'failed',
            code: 'SOURCE_UNAVAILABLE',
            message: 'No authoritative TeX source is available.',
        };

        expect([progress, artifactStart, artifactComplete, failed].every(isRenderHostEvent)).toBe(true);
        expect(isRenderHostEvent({ ...progress, phase: 'downloading' })).toBe(false);
        expect(isRenderHostEvent({
            ...artifactStart,
            metadata: { ...artifactStart.metadata, partNumber: 2, partCount: 1 },
        })).toBe(false);
        expect(isRenderHostEvent({ ...failed, code: 'UNKNOWN' })).toBe(false);
    });
});
