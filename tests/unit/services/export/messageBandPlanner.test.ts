import { describe, expect, it } from 'vitest';
import { planMessageBands } from '../../../../src/services/export/messageBandPlanner';

describe('planMessageBands', () => {
    it('covers every output row once and prefers nearby semantic boundaries', () => {
        const plan = planMessageBands({
            totalPixelHeight: 30_000,
            maxPartPixelHeight: 65_535,
            maxBandPixelHeight: 8_000,
            boundaryPixelRows: [3_900, 7_900, 12_100, 15_800, 23_700, 29_500],
        });

        expect(plan).toHaveLength(1);
        expect(plan[0]!.bands.map((band) => [band.startRow, band.endRow])).toEqual([
            [0, 7_900],
            [7_900, 15_800],
            [15_800, 23_700],
            [23_700, 30_000],
        ]);
    });

    it('uses the minimum number of parts and keeps every band within both budgets', () => {
        const plan = planMessageBands({
            totalPixelHeight: 140_000,
            maxPartPixelHeight: 64_000,
            maxBandPixelHeight: 8_192,
            boundaryPixelRows: [63_500, 127_000],
        });

        expect(plan).toHaveLength(3);
        expect(plan.map((part) => [part.startRow, part.endRow])).toEqual([
            [0, 63_500],
            [63_500, 127_000],
            [127_000, 140_000],
        ]);
        const bands = plan.flatMap((part) => part.bands);
        expect(bands[0]!.startRow).toBe(0);
        expect(bands.at(-1)!.endRow).toBe(140_000);
        expect(bands.every((band) => band.endRow - band.startRow <= 8_192)).toBe(true);
        expect(bands.every((band, index) => index === 0 || bands[index - 1]!.endRow === band.startRow)).toBe(true);
    });
});
