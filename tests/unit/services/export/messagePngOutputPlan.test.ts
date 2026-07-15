import { describe, expect, it } from 'vitest';
import { planMessagePngOutput } from '../../../../src/services/export/messagePngOutputPlan';

describe('planMessagePngOutput', () => {
    it('steps the requested ratio down by 0.5 until one PNG fits the hard budget', () => {
        const plan = planMessagePngOutput({
            widthCssPx: 500,
            heightCssPx: 30_000,
            requestedPixelRatio: 3,
        });

        expect(plan).toMatchObject({
            effectivePixelRatio: 2,
            pixelWidth: 1_000,
            pixelHeight: 60_000,
            partCount: 1,
            multipart: false,
            maxBandPixelHeight: 8_000,
        });
    });

    it('uses the minimum number of parts at 1x when one file still exceeds the hard budget', () => {
        const plan = planMessagePngOutput({
            widthCssPx: 1_000,
            heightCssPx: 100_000,
            requestedPixelRatio: 3,
        });

        expect(plan).toMatchObject({
            effectivePixelRatio: 1,
            pixelWidth: 1_000,
            pixelHeight: 100_000,
            partCount: 2,
            multipart: true,
            maxPartPixelHeight: 64_000,
            maxBandPixelHeight: 8_000,
        });
    });

    it('rejects dimensions and ratios outside the public message PNG contract with a stable code', () => {
        expect(() => planMessagePngOutput({
            widthCssPx: 359,
            heightCssPx: 1_000,
            requestedPixelRatio: 0.5,
        })).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    });
});
