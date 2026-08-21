import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ChatGPT performance benchmark contract', () => {
    it('collects renderer garbage before recording comparable heap usage', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain("await session.send('HeapProfiler.collectGarbage')");
        expect(source).toContain('collectUsedJsHeapAfterGc(context, page)');
    });

    it('keeps verified-snapshot prewarm extension-origin and the explicit panel trigger measurable', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('featureModuleRequests');
        expect(source).toContain('pretriggerHostOriginRequests');
        expect(source).toContain('Idle feature prewarm resolved against the host page origin');
        expect(source).toContain('Export renderer loaded without an image action');
        expect(source).toContain('[data-action="open-bookmarks-panel"]');
        expect(source).toContain('#aimd-bookmarks-panel-host');
        expect(source).toContain('Feature chunk resolved against the host page origin');
        expect(source).toContain('featureLoadMs');
    });

    it('uses canonical route, typed host identities and official DOM completion anchors', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('PERF_CONVERSATION_ID');
        expect(source).toContain('data-message-id="user-${index + 1}"');
        expect(source).toContain('data-message-id="assistant-${index + 1}"');
        expect(source).toContain('data-turn-id="turn-${index + 1}"');
        expect(source).toContain('data-testid="copy-turn-action-button"');
        expect(source).not.toContain('createFixtureGraph');
        expect(source).not.toContain('/api/runtime/conversation-state');
        expect(source).not.toContain('/c/aimd-performance-fixture');
    });

    it('does not suppress verified-snapshot prewarm with a synthetic save-data policy', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).not.toContain("Object.defineProperty(navigator, 'connection'");
        expect(source).not.toContain('value: { saveData: true }');
    });

    it('measures direct atomic selection without allowing repeated DOM writes or long tasks', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('data-aimd-perf-atomic-selection');
        expect(source).toContain('data-latex-source="\\\\frac{x}{y}"');
        expect(source).toContain("context.grantPermissions(");
        expect(source).toContain("page.keyboard.press('Control+Shift+C')");
        expect(source).toContain('navigator.clipboard.readText()');
        expect(source).not.toContain("new ClipboardEvent('copy'");
        expect(source).toContain("selectionContract.copiedMarkdown.includes('$\\\\frac{x}{y}$')");
        expect(source).toContain("selectionContract.copiedTypes.join(',') !== 'text/plain'");
        expect(source).toContain('data-aimd-page-atomic-state');
        expect(source).toContain('Atomic selection performance gate failed');
        expect(source).toContain('selection: PhaseMetrics');
        expect(source).toContain('runRealDragSelection');
        expect(source).toContain('page.mouse.up()');
        expect(source).toContain('runControlDragBenchmark');
        expect(source).toContain('const runs = readPositiveIntegerArg');
        expect(source).toContain('aimd-content-consumer-performance');
        expect(source).toContain('Enabled drag did not receive isolated-world consumer diagnostics');
        expect(source).toContain('drag.materializeCalls !== 1');
        expect(source).toContain('drag.markdownProjectionCalls !== 1');
        expect(source).toContain('drag.materializeRangeToStringCalls < 1');
    });
});
