import { beforeEach, describe, expect, it } from 'vitest';
import {
    configurePerfProbe,
    getPerfFlags,
    perfCount,
    perfMeasure,
    perfReset,
    perfSummary,
} from '../../../src/core/perf/perfProbe';

describe('perfProbe', () => {
    beforeEach(() => {
        localStorage.clear();
        configurePerfProbe({ enabled: false });
        perfReset();
    });

    it('stays inert until enabled', () => {
        perfCount('toolbar.scan');
        perfMeasure('toolbar.scan', 12);

        const summary = perfSummary();
        expect(summary.enabled).toBe(false);
        expect(summary.events).toBe(0);
        expect(summary.metrics).toEqual({});
        expect(summary.counters).toEqual({});
    });

    it('aggregates counters and timing metrics when enabled', () => {
        configurePerfProbe({ enabled: true });

        perfCount('toolbar.messages.discovered', 3);
        perfMeasure('toolbar.scan', 10);
        perfMeasure('toolbar.scan', 30);

        const summary = perfSummary();
        expect(summary.enabled).toBe(true);
        expect(summary.counters['toolbar.messages.discovered']).toBe(3);
        expect(summary.metrics['toolbar.scan']).toMatchObject({
            count: 2,
            totalMs: 40,
            avgMs: 20,
            maxMs: 30,
            p95Ms: 30,
        });
    });

    it('reads localStorage flags for manual browser debugging', () => {
        localStorage.setItem('aimd:perf', '1');
        localStorage.setItem('aimd:perf:flags', JSON.stringify({
            disableWordCount: true,
            disableDirectory: true,
        }));
        configurePerfProbe({ enabled: true });

        const flags = getPerfFlags();
        expect(flags.enabled).toBe(true);
        expect(flags.disableWordCount).toBe(true);
        expect(flags.disableDirectory).toBe(true);
    });
});
