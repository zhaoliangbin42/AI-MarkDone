import { chromium, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type PhaseMetrics = {
    durationMs: number;
    longTaskCount: number;
    longTaskTotalMs: number;
    maxLongTaskMs: number;
    mutationRecords: number;
    mutationBreakdown: Record<string, number>;
};

type RuntimeMetrics = {
    toolbarReadyMs: number;
    toolbarRecoveryMs: number;
    featureLoadMs: number;
    featureModuleRequestCount: number;
    exportRendererRequestCount: number;
    toolbarCount: number;
    duplicateActionRows: number;
    shadowRootCount: number;
    shadowDescendantCount: number;
    usedJsHeapBytes: number | null;
    cold: PhaseMetrics;
    idle: PhaseMetrics;
    selection: PhaseMetrics;
    streaming: PhaseMetrics;
    recovery: PhaseMetrics;
    drag: DragMetrics;
};

type DragMetrics = {
    frameDurationsMs: number[];
    frameP95Ms: number;
    frameMaxMs: number;
    locateCalls: number;
    materializeCalls: number;
    markdownProjectionCalls: number;
    materializeFormulaScans: number;
    rangeToStringCalls: number;
    formulaFullTreeQueries: number;
    materializeRangeToStringCalls: number;
};

type ContentPerformanceEvent = {
    kind: 'selection-frame' | 'materialize' | 'formula-evidence' | 'markdown-projection' | 'markdown-projection-rejection';
    phase: string;
    durationMs?: number;
    locateCalls?: number;
    rangeToStringCalls?: number;
    formulaScans?: number;
    formulaCount?: number;
    exactFormulaMatch?: boolean;
    status?: 'ready' | 'unavailable' | 'no-evidence';
    reason?: string;
    stage?: string;
};

type HarnessState = {
    phaseStartedAt: number;
    longTasks: number[];
    mutationRecords: number;
    mutationBreakdown: Record<string, number>;
    dragging: boolean;
    frameDurationsMs: number[];
    contentEvents: ContentPerformanceEvent[];
};

const DEFAULT_ROUNDS = 200;
const DEFAULT_MUTATIONS = 200;
const TOOLBAR_TIMEOUT_MS = 15_000;
const RECOVERY_TIMEOUT_MS = 8_000;
const FEATURE_LOAD_TIMEOUT_MS = 8_000;
const PERF_CONVERSATION_ID = '6a733f28-5954-83ec-980e-2b824a431951';

function isContentFeatureModuleUrl(url: string): boolean {
    return url.includes('/content-features.js') || url.includes('/content-feature-chunks/');
}

function isExportRendererUrl(url: string): boolean {
    return url.includes('/export-renderer.html')
        || url.includes('/export-renderer.js')
        || url.includes('/export-renderer-chunks/')
        || url.includes('/png-encoder-worker.js');
}

function readPositiveIntegerArg(name: string, fallback: number): number {
    const prefix = `--${name}=`;
    const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid --${name} value: ${raw}`);
    }
    return value;
}

function createFixtureHtml(rounds: number): string {
    const turns = Array.from({ length: rounds }, (_, index) => {
        const atomicSelectionFixture = index === 0
            ? `<h1>Complex answer 1</h1>
              <p data-aimd-perf-atomic-selection><strong>Before <span class="math-inline"><span class="katex" data-latex-source="\\frac{x}{y}"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">\\frac{x}{y}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">x/y</span></span></span> after.</strong></p>
              <p><em>Emphasis</em>, a rendered image, and an inline SVG.</p>
              <ol><li>First item</li><li>Second item</li></ol>
              <table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Alpha</td><td>42</td></tr></tbody></table>
              <pre><code class="language-ts">const answer = 42;</code></pre>
              <img width="320" height="180" alt="Fixed diagram" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23ddd'/%3E%3C/svg%3E" />
              <svg width="320" height="40" viewBox="0 0 320 40" aria-label="diagram"><path d="M1 1h318v38H1z" /></svg>`
            : '';
        const extraAssistantSegments = index === rounds - 1
            ? `
        <div data-message-author-role="assistant" data-message-id="assistant-${index + 1}-segment-2">
          <div class="markdown prose"><p>Answer ${index + 1} continuation 2</p></div>
        </div>
        <div data-message-author-role="assistant" data-message-id="assistant-${index + 1}-segment-3">
          <div class="markdown prose"><p>Answer ${index + 1} continuation 3</p></div>
        </div>`
            : '';
        const assistantBody = index === 0
            ? atomicSelectionFixture
            : `<p>Answer ${index + 1}</p>`;
        return `
      <div data-testid="conversation-turn-${index * 2 + 1}" data-turn="user" data-turn-id="turn-${index + 1}">
        <div data-message-author-role="user" data-message-id="user-${index + 1}"><div class="whitespace-pre-wrap">Prompt ${index + 1}</div></div>
      </div>
      <div data-testid="conversation-turn-${index * 2 + 2}" data-turn="assistant" data-turn-id="turn-${index + 1}">
        <div data-message-author-role="assistant" data-message-id="assistant-${index + 1}">
          <div class="markdown prose">${assistantBody}</div>
        </div>
        ${extraAssistantSegments}
        <div class="z-0 flex"><div><button data-testid="copy-turn-action-button">Copy</button></div></div>
      </div>
    `;
    }).join('');

    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>AI-MarkDone performance fixture</title></head>
  <body>
    <main>
      <div class="fixture_convSearchResultHighlightRoot">
        <div class="fixed inset-e-4 top-1/2 z-20 -translate-y-1/2">Official navigation</div>
        ${turns}
      </div>
    </main>
    <form>
      <div id="prompt-textarea" class="ProseMirror" contenteditable="true"></div>
      <button data-testid="send-button" type="button">Send</button>
    </form>
  </body>
</html>`;
}

async function installHarness(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const state: HarnessState = {
            phaseStartedAt: performance.now(),
            longTasks: [],
            mutationRecords: 0,
            mutationBreakdown: {},
            dragging: false,
            frameDurationsMs: [],
            contentEvents: [],
        };
        (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__ = state;

        document.addEventListener('aimd-content-consumer-performance', (event) => {
            const detail = (event as CustomEvent<string>).detail;
            if (typeof detail !== 'string') return;
            try {
                state.contentEvents.push(JSON.parse(detail) as ContentPerformanceEvent);
            } catch {
                // Ignore malformed diagnostics; the product path must remain
                // independent from the optional benchmark hook.
            }
        });

        // The page-world control has no content consumer. Keep a small
        // page-world rAF timer for that control only; enabled runs prefer the
        // isolated-world coordinator events collected above.
        const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = ((callback: FrameRequestCallback): number => originalRequestAnimationFrame((timestamp) => {
            const startedAt = performance.now();
            callback(timestamp);
            if (state.dragging) state.frameDurationsMs.push(performance.now() - startedAt);
        })) as typeof window.requestAnimationFrame;

        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
        }).observe({ type: 'longtask', buffered: true });

        new MutationObserver((records) => {
            state.mutationRecords += records.length;
            for (const record of records) {
                const key = record.type === 'attributes'
                    ? `attributes:${record.attributeName ?? 'unknown'}`
                    : record.type;
                state.mutationBreakdown[key] = (state.mutationBreakdown[key] ?? 0) + 1;
            }
        }).observe(document, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    });
}

async function resetPhase(page: Page): Promise<void> {
    await page.evaluate(() => {
        const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
        state.phaseStartedAt = performance.now();
        state.longTasks = [];
        state.mutationRecords = 0;
        state.mutationBreakdown = {};
        state.dragging = false;
        state.frameDurationsMs = [];
        state.contentEvents = [];
        document.documentElement.setAttribute('data-aimd-perf-phase', 'idle');
    });
}

async function waitForClipboardText(page: Page, expected: string, timeoutMs = 2_000): Promise<void> {
    await page.evaluate(async ({ expectedText, timeout }) => {
        const startedAt = performance.now();
        while (performance.now() - startedAt < timeout) {
            const current = await navigator.clipboard.readText();
            if (current.includes(expectedText)) return;
            await new Promise<void>((resolveTick) => window.setTimeout(resolveTick, 25));
        }
        const current = await navigator.clipboard.readText();
        const toast = document.querySelector<HTMLElement>('#aimd-toast-viewport')?.textContent?.trim() ?? '';
        const events = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState })
            .__AIMD_PERF_HARNESS__.contentEvents;
        throw new Error(
            `Clipboard did not contain expected text within ${timeout}ms; current=${current}; toast=${toast}; events=${JSON.stringify(events)}`,
        );
    }, { expectedText: expected, timeout: timeoutMs });
}

function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
    return sorted[index] ?? 0;
}

async function runRealDragSelection(page: Page, steps: number, expectConsumerEvents = false): Promise<DragMetrics> {
    const formula = page.locator('[data-aimd-perf-atomic-selection] .katex');
    const box = await formula.boundingBox();
    if (!box) throw new Error('Complex formula fixture has no layout box');
    await page.mouse.move(box.x + Math.max(1, box.width / 2), box.y + Math.max(1, box.height / 2));
    await page.mouse.down();
    await page.evaluate(async (requestedSteps) => {
        const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
        const root = document.querySelector<HTMLElement>('[data-aimd-perf-atomic-selection]')?.closest<HTMLElement>('.markdown.prose');
        const selection = window.getSelection();
        if (!root || !selection) throw new Error('Complex selection fixture is missing');
        const start = root.querySelector<HTMLElement>('.katex-html')?.firstChild as Text | null;
        if (!start) throw new Error('Complex selection fixture has no text nodes');
        const endpointCount = Math.max(1, Math.min(requestedSteps, start.data.length));
        state.dragging = true;
        document.documentElement.setAttribute('data-aimd-perf-phase', 'drag');
        for (let offset = 1; offset <= endpointCount; offset += 1) {
            const range = document.createRange();
            range.setStart(start, 0);
            range.setEnd(start, offset);
            selection.removeAllRanges();
            selection.addRange(range);
            document.dispatchEvent(new Event('selectionchange'));
            await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
        }
    }, steps);
    await page.evaluate(() => document.documentElement.setAttribute('data-aimd-perf-phase', 'pointerup'));
    await page.mouse.up();
    const drag = await page.evaluate((shouldReceiveConsumerEvents) => {
        const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
        state.dragging = false;
        const nonActionEvents = state.contentEvents.filter((event) => event.phase === 'drag' || event.phase === 'pointerup');
        const frameEvents = nonActionEvents.filter((event) => event.kind === 'selection-frame');
        if (shouldReceiveConsumerEvents && frameEvents.length === 0) {
            throw new Error('Enabled drag did not receive isolated-world consumer diagnostics');
        }
        document.documentElement.setAttribute('data-aimd-perf-phase', 'action');
        return {
            frameDurationsMs: frameEvents.length > 0
                ? frameEvents.map((event) => event.durationMs ?? 0)
                : [...state.frameDurationsMs],
            locateCalls: frameEvents.reduce((sum, event) => sum + (event.locateCalls ?? 0), 0),
            materializeCalls: nonActionEvents.filter((event) => event.kind === 'materialize').length,
            markdownProjectionCalls: nonActionEvents.filter((event) => event.kind === 'markdown-projection').length,
            materializeFormulaScans: 0,
            rangeToStringCalls: nonActionEvents.reduce((sum, event) => sum + (event.rangeToStringCalls ?? 0), 0),
            formulaFullTreeQueries: nonActionEvents.reduce((sum, event) => sum + (event.formulaScans ?? 0), 0),
        };
    }, expectConsumerEvents);
    return {
        ...drag,
        frameP95Ms: percentile(drag.frameDurationsMs, 0.95),
        frameMaxMs: Math.max(0, ...drag.frameDurationsMs),
        materializeRangeToStringCalls: 0,
    };
}

async function collectPhase(page: Page): Promise<PhaseMetrics> {
    return page.evaluate(() => {
        const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
        return {
            durationMs: performance.now() - state.phaseStartedAt,
            longTaskCount: state.longTasks.length,
            longTaskTotalMs: state.longTasks.reduce((sum, duration) => sum + duration, 0),
            maxLongTaskMs: Math.max(0, ...state.longTasks),
            mutationRecords: state.mutationRecords,
            mutationBreakdown: { ...state.mutationBreakdown },
        };
    });
}

async function preparePage(context: BrowserContext, rounds: number): Promise<Page> {
    const page = context.pages()[0] ?? await context.newPage();
    await installHarness(page);
    await page.route('https://chatgpt.com/**', async (route) => {
        const url = new URL(route.request().url());
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: createFixtureHtml(rounds),
        });
    });
    return page;
}

async function collectUsedJsHeapAfterGc(context: BrowserContext, page: Page): Promise<number | null> {
    const session = await context.newCDPSession(page);
    try {
        await session.send('HeapProfiler.collectGarbage');
        return page.evaluate(() => {
            const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
            return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
        });
    } finally {
        await session.detach();
    }
}

async function readDiscoveryDiagnosticsFromIsolatedWorld(
    session: CDPSession,
    contextIds: ReadonlySet<number>,
): Promise<unknown | null> {
    for (const contextId of contextIds) {
        const result = await session.send('Runtime.evaluate', {
            contextId,
            expression: 'typeof window.__AIMD_DISCOVERY_DIAGNOSTICS__ === "function" ? window.__AIMD_DISCOVERY_DIAGNOSTICS__() : null',
            returnByValue: true,
        }).catch(() => null);
        const value = result?.result?.value;
        if (value) return value;
    }
    return null;
}

async function runRuntimeBenchmark(extensionPath: string, rounds: number, mutations: number): Promise<RuntimeMetrics> {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aimd-perf-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--enable-precise-memory-info',
            '--no-default-browser-check',
            '--no-first-run',
        ],
    });
    await context.grantPermissions(
        ['clipboard-read', 'clipboard-write'],
        { origin: 'https://chatgpt.com' },
    );

    let featureNetworkSession: CDPSession | null = null;
    try {
        const page = await preparePage(context, rounds);
        const featureModuleRequests = new Set<string>();
        const exportRendererRequests = new Set<string>();
        const isolatedContextIds = new Set<number>();
        featureNetworkSession = await context.newCDPSession(page);
        featureNetworkSession.on('Runtime.executionContextCreated', (event) => {
            if (event.context.auxData?.type === 'isolated') isolatedContextIds.add(event.context.id);
        });
        featureNetworkSession.on('Runtime.executionContextDestroyed', (event) => {
            isolatedContextIds.delete(event.executionContextId);
        });
        featureNetworkSession.on('Network.requestWillBeSent', (event) => {
            const url = event.request.url;
            if (isContentFeatureModuleUrl(url)) featureModuleRequests.add(url);
            if (isExportRendererUrl(url)) exportRendererRequests.add(url);
        });
        await featureNetworkSession.send('Runtime.enable');
        await featureNetworkSession.send('Network.enable');
        page.on('pageerror', (error) => console.error(`[perf:pageerror] ${error.stack ?? error.message}`));
        page.on('console', (message) => {
            if (message.type() === 'warning' || message.type() === 'error') {
                console.error(`[perf:console:${message.type()}] ${message.text()}`);
            }
        });
        console.error('[perf] loading fixture');
        await page.goto(`https://chatgpt.com/c/${PERF_CONVERSATION_ID}`, { waitUntil: 'domcontentloaded' });
        console.error('[perf] waiting for toolbars');
        await page.waitForFunction(
            (expected) => document.querySelectorAll('[data-aimd-role="message-toolbar"]').length === expected,
            rounds,
            { timeout: TOOLBAR_TIMEOUT_MS },
        );
        console.error('[perf] toolbars ready');
        const toolbarReadyMs = await page.evaluate(() => {
            const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
            return performance.now() - state.phaseStartedAt;
        });
        await page.evaluate(async (expectedToolbars) => {
            const initialHosts = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"] div.z-0.flex'))
                .map((row) => row.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]'));
            if (initialHosts.length !== expectedToolbars || initialHosts.some((host) => !host)) {
                throw new Error('Stable-toolbar gate could not capture one host per action row');
            }
            for (let sample = 0; sample < 8; sample += 1) {
                await new Promise<void>((resolveSample) => window.setTimeout(resolveSample, 125));
                const currentHosts = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"] div.z-0.flex'))
                    .map((row) => row.querySelector<HTMLElement>('[data-aimd-role="message-toolbar"]'));
                if (currentHosts.some((host, index) => host !== initialHosts[index])) {
                    throw new Error('Toolbar host identity changed on an unchanged multi-segment page');
                }
            }
        }, rounds);
        await page.waitForTimeout(500);
        const cold = await collectPhase(page);

        await resetPhase(page);
        await page.waitForTimeout(2_000);
        const idle = await collectPhase(page);
        // Heap is a startup/steady-state metric. Capture it before the
        // explicit selection Copy/Comment actions so a deliberately opened
        // action surface cannot masquerade as ordinary runtime retention.
        const steadyHeapBytes = await collectUsedJsHeapAfterGc(context, page);
        console.error(`[perf] discovery diagnostics ${JSON.stringify(
            await readDiscoveryDiagnosticsFromIsolatedWorld(featureNetworkSession, isolatedContextIds),
        )}`);
        const firstToolbar = page.locator('[data-aimd-role="message-toolbar"]').first();
        const firstToolbarState = await firstToolbar.evaluate((host) => ({
            pending: host.getAttribute('data-aimd-pending'),
            actions: Array.from(host.shadowRoot?.querySelectorAll<HTMLButtonElement>('[data-action]') ?? [])
                .map((button) => ({ action: button.dataset.action, disabled: button.disabled })),
        }));
        console.error(`[perf] first toolbar ${JSON.stringify(firstToolbarState)}`);
        await firstToolbar.locator('[data-action="copy_markdown"]').click();
        await waitForClipboardText(page, 'Complex answer 1');
        const wholeMessageMarkdown = await page.evaluate(() => navigator.clipboard.readText());
        const formulaIndex = wholeMessageMarkdown.indexOf('\\' + 'frac{x}{y}');
        console.error(`[perf] first copy formulaContext=${JSON.stringify(
            formulaIndex >= 0 ? wholeMessageMarkdown.slice(Math.max(0, formulaIndex - 24), formulaIndex + 36) : 'missing',
        )}`);
        console.error('[perf] idle phase complete');

        await resetPhase(page);
        const drag = await runRealDragSelection(page, mutations, true);
        await page.waitForSelector('[data-action="page-selection-copy"]', { timeout: 2_000 });
        await page.evaluate(() => navigator.clipboard.writeText('aimd-perf-floating-copy-sentinel'));
        await page.locator('[data-action="page-selection-copy"]').click();
        await waitForClipboardText(page, '$\\frac{x}{y}$');

        await resetPhase(page);
        await runRealDragSelection(page, mutations, true);
        await page.evaluate(() => navigator.clipboard.writeText('aimd-perf-shortcut-sentinel'));
        await page.keyboard.press('Control+Shift+C');
        await waitForClipboardText(page, '$\\frac{x}{y}$');
        const clipboardContract = await page.evaluate(async () => {
            const copiedMarkdown = await navigator.clipboard.readText();
            const clipboardItems = await navigator.clipboard.read();
            return {
                copiedMarkdown,
                copiedTypes: Array.from(new Set(clipboardItems.flatMap((item) => item.types))),
            };
        });

        // Copy is an explicit action that may consume the transient selection
        // toolbar when the browser collapses the native selection on focus.
        // Re-run the real drag path before Comment so the benchmark measures
        // both actions without requiring one transient surface to survive the
        // other action's normal lifecycle.
        await resetPhase(page);
        await runRealDragSelection(page, mutations, true);
        await page.waitForSelector('[data-action="page-comment-add"]', { timeout: 2_000 });
        await page.locator('[data-action="page-comment-add"]').click();
        await page.waitForSelector('[data-action="reader-comment-cancel"], [data-action="cancel"]', { timeout: 2_000 }).catch(() => undefined);
        const actionDiagnostics = await page.evaluate(() => {
            const state = (window as unknown as { __AIMD_PERF_HARNESS__: HarnessState }).__AIMD_PERF_HARNESS__;
            const actionEvents = state.contentEvents.filter((event) => event.phase === 'action');
            return {
                materializeCalls: actionEvents.filter((event) => event.kind === 'materialize').length,
                markdownProjectionCalls: actionEvents.filter((event) => event.kind === 'markdown-projection').length,
                materializeFormulaScans: actionEvents.reduce((sum, event) => sum + (event.formulaScans ?? 0), 0),
                materializeRangeToStringCalls: actionEvents.reduce((sum, event) => sum + (event.rangeToStringCalls ?? 0), 0),
            };
        });
        drag.materializeCalls = actionDiagnostics.materializeCalls;
        drag.markdownProjectionCalls = actionDiagnostics.markdownProjectionCalls;
        drag.materializeFormulaScans = actionDiagnostics.materializeFormulaScans;
        drag.materializeRangeToStringCalls = actionDiagnostics.materializeRangeToStringCalls;
        const selectedCount = await page.evaluate(() => document.querySelectorAll('[data-aimd-page-atomic-state="selected"]').length);
        const clearedCount = await page.evaluate(async () => {
            const selection = window.getSelection();
            if (!selection) throw new Error('Atomic selection fixture lost Selection');
            selection.removeAllRanges();
            document.dispatchEvent(new Event('selectionchange'));
            await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
            await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()));
            return document.querySelectorAll('[data-aimd-page-atomic-state="selected"]').length;
        });
        // The comment path above is real and is part of the contract. Close
        // its transient editor before startup/heap metrics so the steady-state
        // sample measures mounted consumers rather than an intentionally open
        // popover retained by the test itself.
        await page.locator('[data-action="reader-comment-cancel"], [data-action="cancel"]').first().click({ timeout: 1_000 }).catch(() => undefined);
        const selectionContract = { selectedCount, clearedCount, ...clipboardContract };
        await page.waitForTimeout(50);
        const selection = await collectPhase(page);
        const selectionAttributeWrites = selection.mutationBreakdown['attributes:data-aimd-page-atomic-state'] ?? 0;
        if (
            selectionContract.selectedCount < 1
            || selectionContract.clearedCount !== 0
            || !selectionContract.copiedMarkdown.includes('$\\frac{x}{y}$')
            || selectionContract.copiedTypes.join(',') !== 'text/plain'
            || selectionAttributeWrites > 2
            || selection.longTaskCount > 0
            || drag.rangeToStringCalls !== 0
            || drag.formulaFullTreeQueries !== 0
            || drag.materializeCalls !== 1
            || drag.markdownProjectionCalls !== 1
            || drag.materializeFormulaScans !== 1
            || drag.materializeRangeToStringCalls < 1
        ) {
            throw new Error(
                `Atomic selection performance gate failed: selected=${selectionContract.selectedCount}, cleared=${selectionContract.clearedCount}, copied=${selectionContract.copiedMarkdown}, types=${selectionContract.copiedTypes.join(',')}, writes=${selectionAttributeWrites}, longTasks=${selection.longTaskCount}, dragRangeToString=${drag.rangeToStringCalls}, dragFormulaScan=${drag.formulaFullTreeQueries}, materialize=${drag.materializeCalls}, projection=${drag.markdownProjectionCalls}, actionFormulaScan=${drag.materializeFormulaScans}, actionRangeToString=${drag.materializeRangeToStringCalls}`,
            );
        }
        console.error('[perf] atomic selection phase complete');

        await resetPhase(page);
        await page.evaluate(async (mutationCount) => {
            const target = document.querySelector<HTMLElement>('[data-message-id="assistant-1"] .markdown p');
            if (!target) throw new Error('Streaming target is missing');
            for (let index = 0; index < mutationCount; index += 1) {
                target.textContent = `Answer 1 streaming token ${index + 1}`;
                await new Promise<void>((resolveTick) => window.setTimeout(resolveTick, 16));
            }
        }, mutations);
        await page.waitForTimeout(500);
        const streaming = await collectPhase(page);
        console.error('[perf] streaming phase complete');

        await resetPhase(page);
        const recoveryStartedAt = await page.evaluate(() => performance.now());
        const replacedRows = await page.evaluate(() => {
            const turns = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"]'));
            const selected = turns.filter((_turn, index) => index % 10 === 0);
            for (const turn of selected) {
                const oldRow = turn.querySelector<HTMLElement>('div.z-0.flex');
                if (!oldRow) throw new Error('Official action row is missing');
                const nextRow = document.createElement('div');
                nextRow.className = 'z-0 flex';
                const group = document.createElement('div');
                const copyButton = document.createElement('button');
                copyButton.dataset.testid = 'copy-turn-action-button';
                copyButton.textContent = 'Copy';
                group.appendChild(copyButton);
                nextRow.appendChild(group);
                oldRow.replaceWith(nextRow);
            }
            return selected.length;
        });
        await page.waitForFunction(
            ({ expectedRows, expectedToolbars }) => {
                const allRows = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"] div.z-0.flex'));
                const rowsWithOneToolbar = allRows.filter(
                    (row) => row.querySelectorAll('[data-aimd-role="message-toolbar"]').length === 1,
                ).length;
                return expectedRows > 0
                    && allRows.length === expectedToolbars
                    && rowsWithOneToolbar === expectedToolbars;
            },
            { expectedRows: replacedRows, expectedToolbars: rounds },
            { timeout: RECOVERY_TIMEOUT_MS },
        );
        console.error('[perf] toolbar recovery complete');
        const toolbarRecoveryMs = await page.evaluate((startedAt) => performance.now() - startedAt, recoveryStartedAt);
        await page.waitForTimeout(500);
        const recovery = await collectPhase(page);

        const finalDomMetrics = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll<HTMLElement>('*'));
            const actionRows = Array.from(document.querySelectorAll<HTMLElement>('[data-turn="assistant"] div.z-0.flex'));
            return {
                toolbarCount: document.querySelectorAll('[data-aimd-role="message-toolbar"]').length,
                duplicateActionRows: actionRows.filter(
                    (row) => row.querySelectorAll('[data-aimd-role="message-toolbar"]').length !== 1,
                ).length,
                shadowRootCount: allElements.filter((element) => Boolean(element.shadowRoot)).length,
                shadowDescendantCount: allElements.reduce(
                    (sum, element) => sum + (element.shadowRoot?.querySelectorAll('*').length ?? 0),
                    0,
                ),
            };
        });
        const usedJsHeapBytes = steadyHeapBytes;
        const finalMetrics = { ...finalDomMetrics, usedJsHeapBytes };

        if (finalMetrics.toolbarCount !== rounds || finalMetrics.duplicateActionRows !== 0) {
            throw new Error(
                `Toolbar reliability gate failed: ${finalMetrics.toolbarCount}/${rounds} toolbars, ${finalMetrics.duplicateActionRows} invalid action rows`,
            );
        }

        const pretriggerFeatureUrls = Array.from(featureModuleRequests);
        const pretriggerHostOriginRequests = pretriggerFeatureUrls.filter((url) => /^https?:\/\//.test(url));
        if (pretriggerHostOriginRequests.length > 0) {
            throw new Error(`Idle feature prewarm resolved against the host page origin: ${pretriggerHostOriginRequests.join(', ')}`);
        }
        if (exportRendererRequests.size > 0) {
            throw new Error(`Export renderer loaded without an image action: ${Array.from(exportRendererRequests).join(', ')}`);
        }

        const featureLoadStartedAt = await page.evaluate(() => performance.now());
        await page.evaluate(() => {
            const trigger = document.querySelector<HTMLButtonElement>('[data-action="open-bookmarks-panel"]');
            if (!trigger) throw new Error('Bookmarks panel trigger is missing');
            trigger.click();
        });
        await page.waitForSelector('#aimd-bookmarks-panel-host', {
            state: 'attached',
            timeout: FEATURE_LOAD_TIMEOUT_MS,
        });
        const featureLoadMs = await page.evaluate((startedAt) => performance.now() - startedAt, featureLoadStartedAt);
        const requestedFeatureUrls = Array.from(featureModuleRequests);
        const hostOriginFeatureRequests = requestedFeatureUrls.filter((url) => /^https?:\/\//.test(url));
        if (hostOriginFeatureRequests.length > 0) {
            throw new Error(`Feature chunk resolved against the host page origin: ${hostOriginFeatureRequests.join(', ')}`);
        }
        if (!requestedFeatureUrls.some((url) => url.includes('/content-features.js'))) {
            throw new Error('Explicit user trigger did not request content-features.js');
        }
        if (exportRendererRequests.size > 0) {
            throw new Error(`Bookmarks trigger loaded image-export assets: ${Array.from(exportRendererRequests).join(', ')}`);
        }

        return {
            toolbarReadyMs,
            toolbarRecoveryMs,
            featureLoadMs,
            featureModuleRequestCount: featureModuleRequests.size,
            exportRendererRequestCount: exportRendererRequests.size,
            ...finalMetrics,
            cold,
            idle,
            selection,
            drag,
            streaming,
            recovery,
        };
    } finally {
        console.error('[perf] closing browser');
        await featureNetworkSession?.detach().catch(() => undefined);
        await context.close();
        await rm(userDataDir, { recursive: true, force: true });
    }
}

async function runControlDragBenchmark(rounds: number, mutations: number): Promise<DragMetrics> {
    const userDataDir = await mkdtemp(join(tmpdir(), 'aimd-perf-control-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--no-default-browser-check',
            '--no-first-run',
        ],
    });
    try {
        const page = await preparePage(context, rounds);
        await page.goto(`https://chatgpt.com/c/${PERF_CONVERSATION_ID}`, { waitUntil: 'domcontentloaded' });
        await resetPhase(page);
        return await runRealDragSelection(page, mutations);
    } finally {
        await context.close();
        await rm(userDataDir, { recursive: true, force: true });
    }
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[middle] ?? 0
        : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function medianNullable(values: Array<number | null>): number | null {
    const present = values.filter((value): value is number => value !== null);
    return present.length > 0 ? median(present) : null;
}

function medianPhase(phases: PhaseMetrics[]): PhaseMetrics {
    const first = phases[0]!;
    const keys = Object.keys(first.mutationBreakdown);
    return {
        durationMs: median(phases.map((phase) => phase.durationMs)),
        longTaskCount: median(phases.map((phase) => phase.longTaskCount)),
        longTaskTotalMs: median(phases.map((phase) => phase.longTaskTotalMs)),
        maxLongTaskMs: median(phases.map((phase) => phase.maxLongTaskMs)),
        mutationRecords: median(phases.map((phase) => phase.mutationRecords)),
        mutationBreakdown: Object.fromEntries(keys.map((key) => [
            key,
            median(phases.map((phase) => phase.mutationBreakdown[key] ?? 0)),
        ])),
    };
}

function medianDrag(drags: DragMetrics[]): DragMetrics {
    const maxLength = Math.max(0, ...drags.map((drag) => drag.frameDurationsMs.length));
    return {
        frameDurationsMs: Array.from({ length: maxLength }, (_, index) => median(
            drags.map((drag) => drag.frameDurationsMs[index] ?? 0),
        )),
        frameP95Ms: median(drags.map((drag) => drag.frameP95Ms)),
        frameMaxMs: median(drags.map((drag) => drag.frameMaxMs)),
        locateCalls: median(drags.map((drag) => drag.locateCalls)),
        materializeCalls: median(drags.map((drag) => drag.materializeCalls)),
        markdownProjectionCalls: median(drags.map((drag) => drag.markdownProjectionCalls)),
        materializeFormulaScans: median(drags.map((drag) => drag.materializeFormulaScans)),
        rangeToStringCalls: median(drags.map((drag) => drag.rangeToStringCalls)),
        formulaFullTreeQueries: median(drags.map((drag) => drag.formulaFullTreeQueries)),
        materializeRangeToStringCalls: median(drags.map((drag) => drag.materializeRangeToStringCalls)),
    };
}

function medianRuntime(runs: RuntimeMetrics[]): RuntimeMetrics {
    const first = runs[0]!;
    return {
        ...first,
        toolbarReadyMs: median(runs.map((run) => run.toolbarReadyMs)),
        toolbarRecoveryMs: median(runs.map((run) => run.toolbarRecoveryMs)),
        featureLoadMs: median(runs.map((run) => run.featureLoadMs)),
        featureModuleRequestCount: median(runs.map((run) => run.featureModuleRequestCount)),
        exportRendererRequestCount: median(runs.map((run) => run.exportRendererRequestCount)),
        toolbarCount: median(runs.map((run) => run.toolbarCount)),
        duplicateActionRows: median(runs.map((run) => run.duplicateActionRows)),
        shadowRootCount: median(runs.map((run) => run.shadowRootCount)),
        shadowDescendantCount: median(runs.map((run) => run.shadowDescendantCount)),
        usedJsHeapBytes: medianNullable(runs.map((run) => run.usedJsHeapBytes)),
        cold: medianPhase(runs.map((run) => run.cold)),
        idle: medianPhase(runs.map((run) => run.idle)),
        selection: medianPhase(runs.map((run) => run.selection)),
        streaming: medianPhase(runs.map((run) => run.streaming)),
        recovery: medianPhase(runs.map((run) => run.recovery)),
        drag: medianDrag(runs.map((run) => run.drag)),
    };
}

async function main(): Promise<void> {
    const rounds = readPositiveIntegerArg('rounds', DEFAULT_ROUNDS);
    const mutations = readPositiveIntegerArg('mutations', DEFAULT_MUTATIONS);
    const runs = readPositiveIntegerArg('runs', 3);
    const extensionPath = resolve('dist-chrome');
    const contentBytes = await readFile(join(extensionPath, 'content.js'));
    const controlRuns: DragMetrics[] = [];
    const enabledRuns: RuntimeMetrics[] = [];
    for (let index = 0; index < runs; index += 1) {
        console.error(`[perf] control drag run ${index + 1}/${runs}`);
        controlRuns.push(await runControlDragBenchmark(rounds, mutations));
        console.error(`[perf] enabled drag run ${index + 1}/${runs}`);
        enabledRuns.push(await runRuntimeBenchmark(extensionPath, rounds, mutations));
    }
    const control = medianDrag(controlRuns);
    const metrics = medianRuntime(enabledRuns);
    const p95DeltaMs = metrics.drag.frameP95Ms - control.frameP95Ms;
    const maxDeltaMs = metrics.drag.frameMaxMs - control.frameMaxMs;
    if (p95DeltaMs > 4 || maxDeltaMs > 8) {
        throw new Error(`Selection drag budget failed: p95 delta ${p95DeltaMs.toFixed(2)}ms, max delta ${maxDeltaMs.toFixed(2)}ms`);
    }

    process.stdout.write(`${JSON.stringify({
        capturedAt: new Date().toISOString(),
        platform: `${process.platform}-${process.arch}`,
        rounds,
        mutations,
        runs,
        bundle: {
            contentBytes: contentBytes.byteLength,
            contentGzipBytes: gzipSync(contentBytes).byteLength,
        },
        control: { drag: control },
        runtime: metrics,
        selectionBudget: { p95DeltaMs, maxDeltaMs },
    }, null, 2)}\n`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
});
