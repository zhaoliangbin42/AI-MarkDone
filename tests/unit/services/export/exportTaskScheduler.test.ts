import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    __resetExportTaskSchedulerForTests,
    runExclusiveExportTask,
} from '@/services/export/exportTaskScheduler';

describe('exportTaskScheduler', () => {
    afterEach(() => {
        __resetExportTaskSchedulerForTests();
    });

    it('runs high-memory tasks one at a time in FIFO order', async () => {
        let releaseFirst!: () => void;
        const firstBarrier = new Promise<void>((resolve) => { releaseFirst = resolve; });
        const order: string[] = [];

        const first = runExclusiveExportTask(async () => {
            order.push('first:start');
            await firstBarrier;
            order.push('first:end');
            return 1;
        });
        const second = runExclusiveExportTask(async () => {
            order.push('second:start');
            return 2;
        });

        await vi.waitFor(() => expect(order).toEqual(['first:start']));
        releaseFirst();
        await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
        expect(order).toEqual(['first:start', 'first:end', 'second:start']);
    });

    it('removes an aborted queued task without starting it', async () => {
        let releaseFirst!: () => void;
        const firstBarrier = new Promise<void>((resolve) => { releaseFirst = resolve; });
        const secondRun = vi.fn(async () => 2);
        const abort = new AbortController();

        const first = runExclusiveExportTask(async () => {
            await firstBarrier;
            return 1;
        });
        const second = runExclusiveExportTask(secondRun, abort.signal);
        abort.abort();

        await expect(second).rejects.toMatchObject({ name: 'AbortError' });
        releaseFirst();
        await expect(first).resolves.toBe(1);
        expect(secondRun).not.toHaveBeenCalled();
    });
});
