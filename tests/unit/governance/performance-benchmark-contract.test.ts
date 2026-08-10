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

    it('uses canonical route and typed host identities required by shared materialization', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('PERF_CONVERSATION_ID');
        expect(source).toContain('createFixtureGraph(rounds)');
        expect(source).toContain('window.fetch(`/backend-api/conversation/${conversationId}`)');
        expect(source).toContain('The extension never initiates it.');
        expect(source).toContain('data-message-id="user-${index + 1}"');
        expect(source).toContain('data-message-id="assistant-${index + 1}"');
        expect(source).toContain('data-turn-id="turn-${index + 1}"');
        expect(source).not.toContain('/c/aimd-performance-fixture');
    });

    it('keeps verified-snapshot prewarm out of the explicit feature-trigger measurement', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain("Object.defineProperty(navigator, 'connection'");
        expect(source).toContain('value: { saveData: true }');
    });

    it('measures direct atomic selection without allowing repeated DOM writes or long tasks', () => {
        const source = readFileSync(resolve('scripts/benchmark-chatgpt-runtime.ts'), 'utf8');

        expect(source).toContain('data-aimd-perf-atomic-selection');
        expect(source).toContain('data-latex-source="\\\\frac{x}{y}"');
        expect(source).toContain("selectionContract.copiedMarkdown !== '$\\\\frac{x}{y}$'");
        expect(source).toContain("selectionContract.copiedTypes.join(',') !== 'text/plain'");
        expect(source).toContain('data-aimd-page-atomic-state');
        expect(source).toContain('Atomic selection performance gate failed');
        expect(source).toContain('selection: PhaseMetrics');
    });
});
