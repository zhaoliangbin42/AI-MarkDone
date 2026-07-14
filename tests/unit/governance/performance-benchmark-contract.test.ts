import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ChatGPT performance benchmark contract', () => {
    it('collects renderer garbage before recording comparable heap usage', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain("await session.send('HeapProfiler.collectGarbage')");
        expect(source).toContain('collectUsedJsHeapAfterGc(context, page)');
    });

    it('proves heavy content features stay unloaded until a real panel trigger', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('featureModuleRequests');
        expect(source).toContain('[data-action="open-bookmarks-panel"]');
        expect(source).toContain('#aimd-bookmarks-panel-host');
        expect(source).toContain('Feature module loaded before an explicit user trigger');
        expect(source).toContain('Feature chunk resolved against the host page origin');
        expect(source).toContain('featureLoadMs');
    });

    it('measures direct atomic selection without allowing repeated DOM writes or long tasks', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('data-aimd-perf-atomic-selection');
        expect(source).toContain('data-aimd-page-atomic-state');
        expect(source).toContain('Atomic selection performance gate failed');
        expect(source).toContain('selection: PhaseMetrics');
    });
});
