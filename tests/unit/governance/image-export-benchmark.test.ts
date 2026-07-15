import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runImageExportBenchmark } from '../../../scripts/benchmark-image-export';

describe('image export structural verification gate', () => {
    it('keeps 12k, 30k, and 60k fixtures decodable inside the long-PNG budgets', () => {
        const report = runImageExportBenchmark();

        expect(report.fixtures.map((fixture) => fixture.heightCssPx)).toEqual([12_000, 30_000, 60_000]);
        for (const fixture of report.fixtures) {
            expect(fixture.effectivePixelRatio).toBeGreaterThanOrEqual(1);
            expect(fixture.maxBandDevicePixels).toBeLessThanOrEqual(8_000_000);
            expect(fixture.partCount).toBe(1);
            expect(fixture.png).toMatchObject({
                decoded: true,
                heightPx: fixture.pixelHeight,
            });
            expect(fixture.png.idatChunkCount).toBeGreaterThan(0);
        }

        expect(report.fixtures.at(-1)).toMatchObject({
            heightCssPx: 60_000,
            effectivePixelRatio: 1,
            partCount: 1,
        });
    });

    it('keeps the structural probe distinct from the real-browser performance benchmark', () => {
        const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

        expect(packageJson.scripts['verify:image-export-structure']).toBe('tsx scripts/benchmark-image-export.ts');
        expect(packageJson.scripts['benchmark:image-export']).toBe('tsx scripts/harness-image-export.ts');
        expect(packageJson.scripts['benchmark:image-export:30k']).toContain('--long-repeat=88');
        expect(packageJson.scripts['benchmark:image-export:60k']).toContain('--long-repeat=174');
    });
});
