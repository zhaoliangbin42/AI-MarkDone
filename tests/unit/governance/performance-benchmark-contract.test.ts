import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ChatGPT performance benchmark contract', () => {
    it('collects renderer garbage before recording comparable heap usage', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain("await session.send('HeapProfiler.collectGarbage')");
        expect(source).toContain('collectUsedJsHeapAfterGc(context, page)');
    });
});
